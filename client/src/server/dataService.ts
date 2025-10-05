import { getSupabase } from './supabaseClient';

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

  const organizationIds = [...new Set(projects?.map(p => p.organization_id).filter(Boolean))];
  const { data: organizations, error: orgError } = await supabase
    .from('organization')
    .select('*')
    .in('organization_id', organizationIds);
  if (orgError) throw orgError;

  const agencyIds = [...new Set(organizations?.map(o => o.agency_id).filter(Boolean))];
  const { data: agencies, error: agencyError } = await supabase
    .from('agency')
    .select('*')
    .in('agency_id', agencyIds);
  if (agencyError) throw agencyError;

  const orgMap = new Map<string, any>();
  (organizations || []).forEach(o => orgMap.set(o.organization_id, o));
  const agencyMap = new Map<string, any>();
  (agencies || []).forEach(a => agencyMap.set(a.agency_id, a));

  const rowsWithYomi = (projects || []).map((row: any) => {
    const org = orgMap.get(row.organization_id) || {};
    const agency = agencyMap.get(org.agency_id) || {};
    const base = {
      ...row,
      agency_id: agency.agency_id,
      agency_name: agency.agency_name,
      agency_order: agency.agency_order,
      ministry_name: agency.ministry_name || agency.agency_name,
      bureau_agency: org.bureau_office,
      department: org.department,
      division: org.division,
      office: org.unit,
      section: org.section,
      team: org.team,
      total_budget:
        Number(row.initial_budget_total || 0) +
        Number(row.adjustment_total || 0) +
        Number(row.carryover_from_previous_total || 0) +
        Number(row.contingency_total || 0),
    };
    return { ...base };
  });
  mainDataCache = rowsWithYomi;
  mainDataCachedAt = Date.now();
  return rowsWithYomi;
}
