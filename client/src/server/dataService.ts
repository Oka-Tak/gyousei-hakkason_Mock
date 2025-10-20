import { getSupabase } from './supabaseClient';

type ProjectRow = {
  budget_year: number | null;
  project_year: number | null;
  organization_id: string | null;
  initial_budget_total: number | null;
  adjustment_total: number | null;
  carryover_from_previous_total: number | null;
  contingency_total: number | null;
  [key: string]: any;
};

type OrganizationRow = {
  organization_id: string;
  agency_id: string | null;
  bureau_office?: string | null;
  department?: string | null;
  division?: string | null;
  unit?: string | null;
  section?: string | null;
  team?: string | null;
  [key: string]: any;
};

type AgencyRow = {
  agency_id: string;
  agency_name?: string | null;
  agency_order?: number | null;
  ministry_name?: string | null;
  [key: string]: any;
};

// Simple in-memory cache with TTL to avoid repeated heavy work
let mainDataCache: any[] | null = null;
let mainDataCachedAt = 0;
const MAIN_TTL_MS = Number(process.env.MAIN_DATA_TTL_MS || 5 * 60 * 1000); // default 5 minutes
const MAIN_LIMIT = Number(process.env.MAIN_DATA_LIMIT || (process.env.NODE_ENV === 'development' ? 800 : 2000));

export async function fetchMainData() {
  // Serve from cache if fresh
  const now = Date.now();
  if (mainDataCache && now - mainDataCachedAt < MAIN_TTL_MS) {
    return mainDataCache;
  }

  const supabase = getSupabase();
  const { data: projects, error: projectError } = await supabase
    .from('project')
    .select('budget_year, project_year, organization_id, initial_budget_total, adjustment_total, carryover_from_previous_total, contingency_total')
    .eq('budget_year', 2024)
    .limit(MAIN_LIMIT);
  if (projectError) throw projectError;

  const projectRows = (projects ?? []) as ProjectRow[];
  const organizationIds = [...new Set(projectRows.map(p => p.organization_id).filter((id): id is string => !!id))];
  const { data: organizations, error: orgError } = await supabase
    .from('organization')
    .select('*')
    .in('organization_id', organizationIds);
  if (orgError) throw orgError;

  const organizationRows = (organizations ?? []) as OrganizationRow[];
  const agencyIds = [...new Set(organizationRows.map(o => o.agency_id).filter((id): id is string => !!id))];
  const { data: agencies, error: agencyError } = await supabase
    .from('agency')
    .select('*')
    .in('agency_id', agencyIds);
  if (agencyError) throw agencyError;

  const agencyRows = (agencies ?? []) as AgencyRow[];

  const orgMap = new Map<string, OrganizationRow>();
  organizationRows.forEach(o => orgMap.set(o.organization_id, o));
  const agencyMap = new Map<string, AgencyRow>();
  agencyRows.forEach(a => agencyMap.set(a.agency_id, a));

  const rowsWithYomi = projectRows.map((row) => {
    const org = row.organization_id ? orgMap.get(row.organization_id) : undefined;
    const agency = org?.agency_id ? agencyMap.get(org.agency_id) : undefined;
    const base = {
      ...row,
      agency_id: agency?.agency_id,
      agency_name: agency?.agency_name,
      agency_order: agency?.agency_order,
      ministry_name: agency?.ministry_name || agency?.agency_name,
      bureau_agency: org?.bureau_office,
      department: org?.department,
      division: org?.division,
      office: org?.unit,
      section: org?.section,
      team: org?.team,
      total_budget:
        Number(row.initial_budget_total ?? 0) +
        Number(row.adjustment_total ?? 0) +
        Number(row.carryover_from_previous_total ?? 0) +
        Number(row.contingency_total ?? 0),
    };
    return { ...base };
  });
  mainDataCache = rowsWithYomi;
  mainDataCachedAt = Date.now();
  return rowsWithYomi;
}
