import OpenAI from 'openai';
import { getSupabase } from './supabaseClient';

export class OpenAIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIConfigError';
  }
}

export class SemanticSearchServiceError extends Error {
  code: string;

  constructor(message: string, code = 'SEMANTIC_SEARCH_FAILURE') {
    super(message);
    this.name = 'SemanticSearchServiceError';
    this.code = code;
  }
}

type MatchRow = {
  project_id: number;
  budget_year: number;
  similarity?: number;
  score?: number;
  project_name?: string | null;
  surface?: string | null;
  synonyms?: string[] | null;
  keywords?: string[] | null;
};

export type ProjectSemanticMatch = {
  projectId: number;
  budgetYear: number;
  score: number;
  projectName: string;
  surface?: string | null;
  synonyms?: string[] | null;
  keywords?: string[] | null;
};

const OPENAI_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const RPC_NAME = process.env.SUPABASE_PROJECT_MATCH_RPC || 'match_project_semantic';
const DEFAULT_THRESHOLD = Number(process.env.PROJECT_MATCH_THRESHOLD ?? 0.55);

let openaiClient: OpenAI | null = null;

function assertValidApiKey(rawKey: string | undefined) {
  const apiKey = (rawKey || '').trim();
  if (!apiKey) {
    throw new OpenAIConfigError('OpenAI APIキーが設定されていません。client/.env.local の OPENAI_API_KEY に sk- で始まるキーを設定してください。');
  }
  if (apiKey === 'your_openai_api_key_here' || !apiKey.startsWith('sk-')) {
    throw new OpenAIConfigError('OpenAI APIキーが不正です。sk- で始まる実際のキーを OPENAI_API_KEY に設定してください。');
  }
  return apiKey;
}

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const apiKey = assertValidApiKey(process.env.OPENAI_API_KEY);
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

async function getQueryEmbedding(query: string): Promise<number[]> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('Query cannot be empty');
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: OPENAI_MODEL,
    input: trimmed,
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error('Failed to compute embedding from OpenAI response');
  }
  return embedding;
}

function calculateScore(row: MatchRow): number {
  if (typeof row.similarity === 'number' && !Number.isNaN(row.similarity)) return row.similarity;
  if (typeof row.score === 'number' && !Number.isNaN(row.score)) return row.score;
  return 0;
}

function normalizeProjects(rows: MatchRow[], limit: number): ProjectSemanticMatch[] {
  const byName = new Map<string, MatchRow>();
  rows.forEach((row) => {
    const name = (row.project_name || '').trim().toLowerCase();
    const key = name || `id::${row.project_id}`;
    const current = byName.get(key);
    if (!current || calculateScore(row) > calculateScore(current)) {
      byName.set(key, row);
    }
  });

  return Array.from(byName.values())
    .map((row) => {
      const pid = Number(row.project_id);
      return {
        projectId: pid,
        budgetYear: Number(row.budget_year ?? 0) || 0,
        score: calculateScore(row),
        projectName: row.project_name ?? `プロジェクトID ${pid}`,
        surface: row.surface ?? null,
        synonyms: row.synonyms ?? null,
        keywords: row.keywords ?? null,
      } satisfies ProjectSemanticMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function fallbackProjectSearch(query: string, limit: number): Promise<ProjectSemanticMatch[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('project')
    .select('project_id, project_name, budget_year')
    .ilike('project_name', `%${query}%`)
    .order('project_name', { ascending: true })
    .limit(limit * 2);
  if (error) {
    throw new SemanticSearchServiceError(`プロジェクト名検索に失敗しました: ${error.message}`, error.code ?? 'SUPABASE_PROJECT_QUERY_FAILED');
  }

  const rows = (data ?? []) as Array<{ project_id: number; project_name: string | null; budget_year: number | null }>;
  if (!rows.length) return [];

  return rows
    .map((row) => ({
      projectId: Number(row.project_id),
      budgetYear: Number(row.budget_year ?? 0) || 0,
      score: 0.05,
      projectName: row.project_name ?? '名称不明',
    }))
    .filter((match, index, self) => self.findIndex((m) => m.projectName === match.projectName) === index)
    .slice(0, limit);
}

export async function searchProjectsSemantically(input: { query: string; limit?: number; threshold?: number }): Promise<ProjectSemanticMatch[]> {
  const { query, limit = 8, threshold } = input;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = getSupabase();

  let rows: MatchRow[] = [];
  let encounteredError: Error | null = null;

  try {
    const embedding = await getQueryEmbedding(trimmed);
    const desired = Math.min(Math.max(limit, 1), 20);
    const thresholdsToTry = Array.from(
      new Set([
        typeof threshold === 'number' ? threshold : DEFAULT_THRESHOLD,
        0.5,
        0.35,
        0.2,
        0.0,
      ]),
    );

    for (const thr of thresholdsToTry) {
      const { data, error } = await supabase.rpc(
        RPC_NAME,
        {
          query_embedding: embedding,
          match_count: desired * 3,
          match_threshold: thr,
        } as never,
      );

      if (error) {
        encounteredError = error;
        break;
      }

      const candidateRows = (data ?? []) as MatchRow[];
      if (candidateRows.length) {
        rows = candidateRows;
        break;
      }
    }
  } catch (err) {
    encounteredError = err instanceof Error ? err : new Error(String(err));
  }

  if (encounteredError) {
    console.warn('[semanticSearch] RPC fallback triggered:', encounteredError.message);
    return fallbackProjectSearch(trimmed, Math.min(Math.max(limit, 1), 20));
  }

  if (!rows.length) {
    // fallback to simple contains search when embeddings yield nothing
    const fallbackResults = await fallbackProjectSearch(trimmed, Math.min(Math.max(limit, 1), 20));
    if (fallbackResults.length) return fallbackResults;
    return [] as ProjectSemanticMatch[];
  }

  const budgetYears = new Set(rows.map(r => r.budget_year));

  const missingNameIds = rows.filter(r => !r.project_name).map(r => r.project_id);
  let projectNameById = new Map<number, string>();

  if (missingNameIds.length) {
    let projectQuery = supabase
      .from('project')
      .select('project_id, budget_year, project_name')
      .in('project_id', Array.from(new Set(missingNameIds)));

    if (budgetYears.size === 1) {
      projectQuery = projectQuery.eq('budget_year', Array.from(budgetYears)[0]);
    }

    const { data: projectRows, error: projectErr } = await projectQuery;
    if (projectErr) throw projectErr;
    (projectRows ?? []).forEach((p: any) => {
      const pid = Number(p.project_id);
      if (!Number.isFinite(pid)) return;
      const name = (p.project_name as string | null) ?? '';
      if (name) projectNameById.set(pid, name);
    });
  }

  const normalized = rows.map((row) => ({
    ...row,
    project_name: row.project_name ?? projectNameById.get(Number(row.project_id)) ?? null,
  }));

  return normalizeProjects(normalized, Math.min(Math.max(limit, 1), 20));
}
