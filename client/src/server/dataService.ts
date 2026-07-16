import { getSupabase } from './supabaseClient';
import { CACHE_TTL, BUDGET_YEAR } from './constants';

type ProjectRow = {
  project_id: number;
  project_name: string | null;
  budget_year: number | null;
  project_year: number | null;
  organization_id: string | null;
  initial_budget_total: number | null;
  adjustment_total: number | null;
  carryover_from_previous_total: number | null;
  contingency_total: number | null;
};

type OrganizationRow = {
  organization_id: string;
  agency_id: string | null;
  bureau_office?: string | null;
  department?: string | null;
  division?: string | null;
  unit?: string | null;
  section?: string | null;
  group?: string | null;
  team?: string | null;
};

type AgencyRow = {
  agency_id: string;
  agency_name?: string | null;
  agency_order?: number | null;
  ministry_name?: string | null;
};

export type MainDataRow = {
  project_id: number;
  project_name: string | null;
  budget_year: number | null;
  project_year: number | null;
  organization_id: string | null;
  initial_budget_total: number | null;
  adjustment_total: number | null;
  carryover_from_previous_total: number | null;
  contingency_total: number | null;
  agency_id?: string;
  agency_name?: string | null;
  agency_order?: number | null;
  ministry_name?: string | null;
  bureau_agency?: string | null;
  department?: string | null;
  division?: string | null;
  office?: string | null;
  section?: string | null;
  group?: string | null;
  team?: string | null;
  total_budget: number;
};

// Simple in-memory cache with TTL to avoid repeated heavy work
let mainDataCache: MainDataRow[] | null = null;
let mainDataCachedAt = 0;
let mainDataInFlight: Promise<MainDataRow[]> | null = null;
const MAIN_LIMIT = Number(process.env.MAIN_DATA_LIMIT || (process.env.NODE_ENV === 'development' ? 800 : 2000));

async function loadMainData(): Promise<MainDataRow[]> {
  const supabase = getSupabase();
  const { data: projects, error: projectError } = await supabase
    .from('project')
    .select('project_id, project_name, budget_year, project_year, organization_id, initial_budget_total, adjustment_total, carryover_from_previous_total, contingency_total')
    .eq('budget_year', BUDGET_YEAR.CURRENT)
    .order('initial_budget_total', { ascending: false })
    .limit(MAIN_LIMIT);
  if (projectError) throw projectError;

  const projectRows = (projects ?? []) as ProjectRow[];
  if (projectRows.length === 0) return [];
  const organizationIds = [...new Set(projectRows.map(p => p.organization_id).filter((id): id is string => !!id))];
  let organizationRows: OrganizationRow[] = [];
  if (organizationIds.length > 0) {
    const { data: organizations, error: orgError } = await supabase
      .from('organization')
      .select('organization_id, agency_id, bureau_office, department, division, unit, section, group, team')
      .in('organization_id', organizationIds);
    if (orgError) throw orgError;
    organizationRows = (organizations ?? []) as OrganizationRow[];
  }

  const agencyIds = [...new Set(organizationRows.map(o => o.agency_id).filter((id): id is string => !!id))];
  let agencyRows: AgencyRow[] = [];
  if (agencyIds.length > 0) {
    const { data: agencies, error: agencyError } = await supabase
      .from('agency')
      .select('agency_id, agency_name, agency_order, ministry_name')
      .in('agency_id', agencyIds);
    if (agencyError) throw agencyError;
    agencyRows = (agencies ?? []) as AgencyRow[];
  }

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
      group: org?.group,
      team: org?.team,
      total_budget:
        Number(row.initial_budget_total ?? 0) +
        Number(row.adjustment_total ?? 0) +
        Number(row.carryover_from_previous_total ?? 0) +
        Number(row.contingency_total ?? 0),
    };
    return base;
  });
  return rowsWithYomi;
}

export async function fetchMainData(): Promise<MainDataRow[]> {
  const now = Date.now();
  if (mainDataCache && now - mainDataCachedAt < CACHE_TTL.MAIN_DATA) {
    return mainDataCache;
  }
  if (mainDataInFlight) return mainDataInFlight;

  mainDataInFlight = loadMainData();
  try {
    const rows = await mainDataInFlight;
    mainDataCache = rows;
    mainDataCachedAt = Date.now();
    return rows;
  } finally {
    mainDataInFlight = null;
  }
}
