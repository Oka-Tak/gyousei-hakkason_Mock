import OpenAI from 'openai';
import { getSupabase } from './supabaseClient';
import { QUERY_LIMITS, SEMANTIC_SEARCH } from './constants';

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

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateScore(row: MatchRow): number {
  const similarity = toNumber(row.similarity ?? row.score);
  if (similarity !== null) {
    // Supabase match RPC returns cosine similarity (0-1) when using pgvector.
    if (similarity >= 0 && similarity <= 1) return similarity;
    if (similarity > 1) return 1 / (1 + similarity);
  }
  const distance = toNumber((row as any).distance ?? (row as any).metric);
  if (distance !== null) {
    const normalized = 1 - Math.min(Math.max(distance, 0), 1);
    return normalized;
  }
  return 0;
}

function normalizeProjects(rows: MatchRow[], limit: number): ProjectSemanticMatch[] {
  const byId = new Map<number, MatchRow>();
  const byName = new Map<string, MatchRow>();

  rows.forEach((row) => {
    const id = Number(row.project_id);
    if (!Number.isFinite(id)) return;
    const nameKey = (row.project_name || '').trim().toLowerCase() || `id::${id}`;

    const score = calculateScore(row);
    const existingById = byId.get(id);
    if (!existingById || score > calculateScore(existingById)) byId.set(id, row);

    const existingByName = byName.get(nameKey);
    if (!existingByName || score > calculateScore(existingByName)) byName.set(nameKey, row);
  });

  return Array.from(new Set([...byName.values(), ...byId.values()]))
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
    .limit(limit * 4);
  if (error) {
    throw new SemanticSearchServiceError(`プロジェクト名検索に失敗しました: ${error.message}`, error.code ?? 'SUPABASE_PROJECT_QUERY_FAILED');
  }

  const rows = (data ?? []) as Array<{ project_id: number; project_name: string | null; budget_year: number | null }>;
  if (!rows.length) return [];

  return rows
    .map((row) => ({
      projectId: Number(row.project_id),
      budgetYear: Number(row.budget_year ?? 0) || 0,
      score: SEMANTIC_SEARCH.FALLBACK_SCORE,
      projectName: row.project_name ?? '名称不明',
    }))
    .filter((match, index, self) => self.findIndex((m) => m.projectName === match.projectName) === index)
    .slice(0, limit);
}

export async function searchProjectsSemantically(input: { query: string; limit?: number; threshold?: number }): Promise<ProjectSemanticMatch[]> {
  const { query, limit = QUERY_LIMITS.SEMANTIC_SEARCH_DEFAULT, threshold } = input;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = getSupabase();

  let rows: MatchRow[] = [];
  let encounteredError: Error | null = null;

  try {
    const embedding = await getQueryEmbedding(trimmed);
    const desired = Math.min(Math.max(limit, 1), QUERY_LIMITS.SEMANTIC_SEARCH_MAX);
    const thresholdsToTry = Array.from(
      new Set([
        typeof threshold === 'number' ? threshold : SEMANTIC_SEARCH.DEFAULT_THRESHOLD,
        ...SEMANTIC_SEARCH.THRESHOLDS_TO_TRY,
      ]),
    );

    const aggregated: MatchRow[] = [];
    const seenIds = new Set<number>();

    for (const thr of thresholdsToTry) {
      const { data, error } = await supabase.rpc(
        RPC_NAME,
        {
          query_embedding: embedding,
          match_count: desired * QUERY_LIMITS.SEMANTIC_SEARCH_MULTIPLIER,
          match_threshold: thr,
        } as never,
      );

      if (error) {
        encounteredError = error;
        break;
      }

      const candidateRows = (data ?? []) as MatchRow[];
      candidateRows.forEach((row) => {
        const pid = Number(row.project_id);
        if (!Number.isFinite(pid)) return;
        if (seenIds.has(pid)) return;
        seenIds.add(pid);
        aggregated.push(row);
      });

      if (aggregated.length >= desired) break;
    }

    rows = aggregated;
  } catch (err) {
    encounteredError = err instanceof Error ? err : new Error(String(err));
  }

  if (encounteredError) {
    return fallbackProjectSearch(trimmed, Math.min(Math.max(limit, 1), QUERY_LIMITS.SEMANTIC_SEARCH_MAX));
  }

  if (!rows.length) {
    // fallback to simple contains search when embeddings yield nothing
    const fallbackResults = await fallbackProjectSearch(trimmed, Math.min(Math.max(limit, 1), QUERY_LIMITS.SEMANTIC_SEARCH_MAX));
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

  return normalizeProjects(normalized, Math.min(Math.max(limit, 1), QUERY_LIMITS.SEMANTIC_SEARCH_MAX));
}
