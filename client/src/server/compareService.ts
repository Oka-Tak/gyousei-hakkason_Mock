import { fetchMainData, type MainDataRow } from './dataService';
import { fetchTopRecipientsByAgency, fetchTopRecipientsByProject } from './insightService';
import { getSupabase } from './supabaseClient';
import { BUDGET_YEAR } from './constants';

type CompareTargetAgency = {
  type: 'agency';
  value: string;
  label: string;
};

type CompareTargetProject = {
  type: 'project';
  projectId: number;
  label: string;
};

type CompareTarget = CompareTargetAgency | CompareTargetProject;

type BudgetSummary = {
  total: number;
  projectCount: number;
  firstLevel: Array<{ name: string; value: number }>;
};

type CompareSummary = BudgetSummary & {
  target: CompareTarget;
};

function summarizeRows(rows: readonly MainDataRow[]): BudgetSummary {
  const total = rows.reduce((sum, row) => sum + Number(row.total_budget || 0), 0);
  const projectCount = new Set(rows.map((row) => row.project_id)).size;
  const firstLevel = new Map<string, number>();

  rows.forEach((row) => {
    const name = row.bureau_agency || 'その他';
    firstLevel.set(name, (firstLevel.get(name) || 0) + Number(row.total_budget || 0));
  });

  return {
    total,
    projectCount,
    firstLevel: Array.from(firstLevel, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  };
}

export async function fetchAgencyBudgetSummary(agencyName?: string): Promise<BudgetSummary> {
  const rows = await fetchMainData();
  const selectedRows = agencyName
    ? rows.filter((row) => row.agency_name === agencyName || row.ministry_name === agencyName)
    : rows;
  return summarizeRows(selectedRows);
}

async function fetchProjectSummary(projectId: number): Promise<CompareSummary | null> {
  const supabase = getSupabase();
  const { data: projectRowsRaw, error: projectErr } = await supabase
    .from('project')
    .select('project_id, project_name, organization_id, budget_year, initial_budget_total, adjustment_total, carryover_from_previous_total, contingency_total')
    .eq('project_id', projectId)
    .eq('budget_year', BUDGET_YEAR.CURRENT);
  if (projectErr) throw projectErr;
  const projectRows = (projectRowsRaw ?? []) as Array<{
    project_id: number;
    project_name: string | null;
    organization_id: string | null;
    budget_year: number | null;
    initial_budget_total: number | null;
    adjustment_total: number | null;
    carryover_from_previous_total: number | null;
    contingency_total: number | null;
  }>;
  if (!projectRows.length) return null;

  const project = projectRows[0];
  const budgetYear = project.budget_year ?? BUDGET_YEAR.CURRENT;

  const { data: blockRowsRaw, error: blockErr } = await supabase
    .from('project_spending_block')
    .select('block_id, block_name, block_total_amount')
    .eq('project_id', projectId)
    .eq('budget_year', budgetYear);
  if (blockErr) throw blockErr;
  const blockRows = (blockRowsRaw ?? []) as Array<{
    block_id: number;
    block_name: string | null;
    block_total_amount: number | null;
  }>;

  const blockIds = blockRows.map(b => b.block_id).filter((id): id is number => Number.isFinite(id));
  let spendingRows: Array<{ block_id: number; amount: number | null }> = [];
  if (blockIds.length) {
    const { data: spendingRaw, error: spendingErr } = await supabase
      .from('project_spending')
      .select('block_id, amount')
      .in('block_id', blockIds)
      .eq('budget_year', budgetYear);
    if (spendingErr) throw spendingErr;
    spendingRows = (spendingRaw ?? []) as Array<{ block_id: number; amount: number | null }>;
  }

  const amountByBlock = new Map<number, number>();
  spendingRows.forEach((row) => {
    const existing = amountByBlock.get(row.block_id) ?? 0;
    amountByBlock.set(row.block_id, existing + Number(row.amount || 0));
  });

  let total = 0;
  const firstLevel = blockRows
    .map((block) => {
      const fromSpending = amountByBlock.get(block.block_id) ?? 0;
      const value = fromSpending > 0 ? fromSpending : Number(block.block_total_amount || 0);
      total += value;
      return {
        name: block.block_name || `ブロック ${block.block_id}`,
        value,
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (total <= 0) {
    total =
      Number(project.initial_budget_total ?? 0) +
      Number(project.adjustment_total ?? 0) +
      Number(project.carryover_from_previous_total ?? 0) +
      Number(project.contingency_total ?? 0);
  }

  const label = project.project_name || `プロジェクトID ${projectId}`;

  return {
    target: { type: 'project', projectId: Number(projectId), label },
    total,
    projectCount: 1,
    firstLevel,
  };
}

export async function fetchCompareSummary(input: { type: 'agency'; value: string } | { type: 'project'; projectId: number }): Promise<CompareSummary | null> {
  if (input.type === 'agency') {
    const { value } = input;
    const summary = await fetchAgencyBudgetSummary(value);
    if (summary.projectCount === 0) return null;

    return {
      target: { type: 'agency', value, label: value },
      ...summary,
    };
  }

  const { projectId } = input;
  return fetchProjectSummary(projectId);
}

export async function fetchCompareRecipients(input: { type: 'agency'; value: string; limit?: number } | { type: 'project'; projectId: number; limit?: number }) {
  if (input.type === 'agency') {
    return fetchTopRecipientsByAgency(input.value, input.limit);
  }
  return fetchTopRecipientsByProject(input.projectId, input.limit);
}
