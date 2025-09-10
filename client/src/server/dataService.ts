import { getSupabase } from './supabaseClient';
import { getTokenizer, toHiragana } from './kuromoji';

export async function fetchMainData() {
  const supabase = getSupabase();
  const { data: projects, error: projectError } = await supabase
    .from('project')
    .select('budget_year, project_year, organization_id, initial_budget_total, adjustment_total, carryover_from_previous_total, contingency_total')
    .eq('budget_year', 2024)
    .limit(2000);
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

  const tokenizer = await getTokenizer();
  const nameKeys = ['agency_name', 'ministry_name', 'bureau_agency', 'department', 'division', 'office', 'section', 'group', 'team', 'project_name'];

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
    const yomiObj: Record<string, string> = {};
    nameKeys.forEach(key => {
      const val = (base as any)[key];
      yomiObj[key + '_yomi'] = (val && typeof val === 'string') ? toHiragana(tokenizer, val) : '';
    });
    return { ...base, ...yomiObj };
  });
  return rowsWithYomi;
}

