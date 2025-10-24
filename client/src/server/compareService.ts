import { fetchMainData } from './dataService';
import { fetchTopRecipientsByAgency, fetchTopRecipientsByProject } from './insightService';
import { getSupabase } from './supabaseClient';

export type CompareTargetAgency = {
  type: 'agency';
  value: string;
  label: string;
};

export type CompareTargetProject = {
  type: 'project';
  projectId: number;
  label: string;
};

export type CompareTarget = CompareTargetAgency | CompareTargetProject;

export type CompareSummary = {
  target: CompareTarget;
  total: number;
  projectCount: number;
  firstLevel: Array<{ name: string; value: number }>;
};

function buildProjectSummary(projectId: number, rows: any[]): CompareSummary {
  const projectRow = rows[0];
  const label = (projectRow.project_name as string | null) || `プロジェクトID ${projectId}`;
  const total = rows.reduce((sum: number, row: any) => sum + Number(row.total_budget || 0), 0);
  const firstLevelMap = new Map<string, number>();
  rows.forEach((row: any) => {
    const key = row.bureau_agency || row.agency_name || 'その他';
    firstLevelMap.set(key, (firstLevelMap.get(key) || 0) + Number(row.total_budget || 0));
  });
  const firstLevel = Array.from(firstLevelMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    target: { type: 'project', projectId: Number(projectId), label },
    total,
    projectCount: 1,
    firstLevel,
  };
}

async function fetchSingleProjectSummary(projectId: number): Promise<CompareSummary | null> {
  const supabase = getSupabase();
  const { data: projectRowsRaw, error: projectErr } = await supabase
    .from('project')
    .select('project_id, project_name, organization_id, budget_year, initial_budget_total, adjustment_total, carryover_from_previous_total, contingency_total')
    .eq('project_id', projectId)
    .eq('budget_year', 2024);
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

  const organizationIds = Array.from(new Set(projectRows.map(r => r.organization_id).filter((id): id is string => !!id)));
  const { data: orgRowsRaw, error: orgErr } = await supabase
    .from('organization')
    .select('organization_id, bureau_office, department, division, unit, section, team, agency_id')
    .in('organization_id', organizationIds);
  if (orgErr) throw orgErr;
  const orgRows = (orgRowsRaw ?? []) as Array<{
    organization_id: string;
    bureau_office?: string | null;
    department?: string | null;
    division?: string | null;
    unit?: string | null;
    section?: string | null;
    team?: string | null;
    agency_id?: string | null;
  }>;
  const agencyIds = Array.from(new Set(orgRows.map(o => o.agency_id).filter((id): id is string => !!id)));
  const { data: agencyRowsRaw, error: agencyErr } = await supabase
    .from('agency')
    .select('agency_id, agency_name, ministry_name')
    .in('agency_id', agencyIds);
  if (agencyErr) throw agencyErr;
  const agencyRows = (agencyRowsRaw ?? []) as Array<{
    agency_id: string;
    agency_name: string | null;
    ministry_name: string | null;
  }>;

  const orgById = new Map<string, typeof orgRows[number]>();
  orgRows.forEach(o => orgById.set(o.organization_id, o));
  const agencyById = new Map<string, typeof agencyRows[number]>();
  agencyRows.forEach(a => agencyById.set(a.agency_id, a));

  const enrichedRows = projectRows.map((row) => {
    const org = row.organization_id ? orgById.get(row.organization_id) : undefined;
    const agency = org?.agency_id ? agencyById.get(org.agency_id) : undefined;
    return {
      ...row,
      agency_id: agency?.agency_id,
      agency_name: agency?.agency_name,
      ministry_name: agency?.ministry_name || agency?.agency_name,
      bureau_agency: org?.bureau_office,
      total_budget:
        Number(row.initial_budget_total ?? 0) +
        Number(row.adjustment_total ?? 0) +
        Number(row.carryover_from_previous_total ?? 0) +
        Number(row.contingency_total ?? 0),
    };
  });

  return buildProjectSummary(projectId, enrichedRows);
}

export async function fetchCompareSummary(input: { type: 'agency'; value: string } | { type: 'project'; projectId: number }): Promise<CompareSummary | null> {
  const rows = await fetchMainData();
  if (!rows.length) return null;

  if (input.type === 'agency') {
    const { value } = input;
    const filtered = rows.filter((r: any) => r.agency_name === value || r.ministry_name === value);
    if (!filtered.length) return null;

    const total = filtered.reduce((sum: number, row: any) => sum + Number(row.total_budget || 0), 0);
    const projectIds = new Set<number>();
    filtered.forEach((r: any) => {
      if (typeof r.project_id === 'number') projectIds.add(r.project_id);
    });
    const projectCount = projectIds.size || filtered.length;
    const firstLevelMap = new Map<string, number>();
    filtered.forEach((row: any) => {
      const key = row.bureau_agency || 'その他';
      firstLevelMap.set(key, (firstLevelMap.get(key) || 0) + Number(row.total_budget || 0));
    });
    const firstLevel = Array.from(firstLevelMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      target: { type: 'agency', value, label: value },
      total,
      projectCount,
      firstLevel,
    };
  }

  const { projectId } = input;
  const filtered = rows.filter((r: any) => Number(r.project_id) === Number(projectId));

  if (!filtered.length) {
    const fallback = await fetchSingleProjectSummary(projectId);
    return fallback;
  }

  return buildProjectSummary(projectId, filtered);
}

export async function fetchCompareRecipients(input: { type: 'agency'; value: string; limit?: number } | { type: 'project'; projectId: number; limit?: number }) {
  if (input.type === 'agency') {
    return fetchTopRecipientsByAgency(input.value, input.limit);
  }
  return fetchTopRecipientsByProject(input.projectId, input.limit);
}
