import OpenAI from 'openai';
import { getSupabase } from './supabaseClient';

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
const DEFAULT_THRESHOLD = Number(process.env.PROJECT_MATCH_THRESHOLD ?? 0.7);

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for semantic search');
  }
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

export async function searchProjectsSemantically(input: { query: string; limit?: number; threshold?: number }): Promise<ProjectSemanticMatch[]> {
  const { query, limit = 8, threshold } = input;
  const embedding = await getQueryEmbedding(query);

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(
    RPC_NAME,
    {
      query_embedding: embedding,
      match_count: Math.min(Math.max(limit, 1), 20),
      match_threshold: typeof threshold === 'number' ? threshold : DEFAULT_THRESHOLD,
    } as never,
  );
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MatchRow[];
  if (!rows.length) return [] as ProjectSemanticMatch[];

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

  return rows
    .map<ProjectSemanticMatch>((row) => {
      const pid = Number(row.project_id);
      const score = typeof row.similarity === 'number' ? row.similarity : typeof row.score === 'number' ? row.score : 0;
      const projectName = row.project_name ?? projectNameById.get(pid) ?? '名称不明';
      return {
        projectId: pid,
        budgetYear: Number(row.budget_year),
        score,
        projectName,
        surface: row.surface ?? null,
        synonyms: row.synonyms ?? null,
        keywords: row.keywords ?? null,
      };
    })
    .sort((a, b) => b.score - a.score);
}
