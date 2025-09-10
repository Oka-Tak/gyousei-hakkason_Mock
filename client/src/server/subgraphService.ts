import { z } from 'zod';
import { getSupabase } from './supabaseClient';
import { RawProjectDataSchema } from '@/types/schemas';

const ORG_FIELD_ORDER = ['bureau_office', 'department', 'division', 'unit', 'section', 'group', 'team'] as const;
const PROJECT_LIMIT_DEFAULT = 600;

export async function fetchSubgraph(nodeId: string, opts?: { projectLimit?: number }) {
  const supabase = getSupabase();
  const decoded = decodeURIComponent(nodeId);
  const parts = decoded.split('→').filter(Boolean);
  const topLevelOrg = parts[0];
  const tail = parts.slice(1); // hierarchy under agency
  const projectLimit = opts?.projectLimit ?? PROJECT_LIMIT_DEFAULT;

  // 1) resolve agency
  const { data: agencies, error: agencyError } = await supabase
    .from('agency')
    .select('agency_id, agency_name, agency_order')
    .eq('agency_name', topLevelOrg);
  if (agencyError) throw agencyError;
  if (!agencies?.length) return [];
  const agencyIds = agencies.map(a => a.agency_id);

  // 2) filter organizations by tail path
  let orgQuery = supabase
    .from('organization')
    .select('organization_id, agency_id, bureau_office, department, division, unit, section, team')
    .in('agency_id', agencyIds);
  for (let i = 0; i < tail.length && i < ORG_FIELD_ORDER.length; i++) {
    const value = tail[i];
    const field = ORG_FIELD_ORDER[i];
    if (value) orgQuery = orgQuery.eq(field, value);
  }
  const { data: organizations, error: orgError } = await orgQuery;
  if (orgError) throw orgError;
  if (!organizations?.length) return [];
  const organizationIds = organizations.map(o => o.organization_id);

  // 3) projects under those organizations (limit + order)
  const { data: projects, error: pError } = await supabase
    .from('project')
    .select('project_id, organization_id, budget_year, initial_budget_total')
    .in('organization_id', organizationIds)
    .eq('budget_year', 2024)
    .order('initial_budget_total', { ascending: false })
    .limit(projectLimit);
  if (pError) throw pError;
  if (!projects?.length) return [];
  const projectIds = projects.map(p => p.project_id);

  // 4) blocks for projects (limit to prevent explosion)
  const { data: blocks, error: psbError } = await supabase
    .from('project_spending_block')
    .select('block_id, project_id, block_total_amount')
    .in('project_id', projectIds)
    .limit(3000);
  if (psbError) throw psbError;
  const blockIds = (blocks || []).map((b: any) => b.block_id);

  // include spending only if reasonable size
  const includeSpending = (projects.length <= 400) && (blockIds.length <= 2000);
  let spendings: any[] = [];
  if (includeSpending && blockIds.length > 0) {
    const { data: s, error: sError } = await supabase
      .from('project_spending')
      .select('block_id, recipient_name, corporate_number, amount')
      .in('block_id', blockIds)
      .limit(5000);
    if (sError) throw sError;
    spendings = s || [];
  }

  // maps
  const orgMap = new Map<string, any>();
  organizations.forEach(o => orgMap.set(o.organization_id, o));
  const agencyById = new Map<string, any>();
  agencies.forEach(a => agencyById.set(a.agency_id, a));
  const projectMap = new Map<number, any>();
  (projects || []).forEach((p: any) => projectMap.set(p.project_id, p));
  const spendingByBlock = new Map<number, any[]>();
  (spendings || []).forEach(sp => {
    const k = sp.block_id;
    if (!spendingByBlock.has(k)) spendingByBlock.set(k, []);
    spendingByBlock.get(k)!.push(sp);
  });

  const merged = (blocks || []).map((block: any) => {
    const proj = projectMap.get(block.project_id) || {};
    const org = orgMap.get(proj.organization_id) || {};
    const ag = agencyById.get(org.agency_id) || {};
    const initial_budget_total = block.block_total_amount ?? proj.initial_budget_total ?? 0;
    const spending_list = includeSpending ? (spendingByBlock.get(block.block_id) || []) : [];
    return {
      ...block,
      ...proj,
      agency_id: ag.agency_id,
      agency_name: ag.agency_name,
      agency_order: ag.agency_order,
      ministry_name: ag.agency_name,
      bureau_agency: org.bureau_office,
      department: org.department,
      division: org.division,
      office: org.unit,
      section: org.section,
      group: null,
      team: org.team,
      initial_budget_total,
      spending_list,
    };
  });

  const validated = z.array(RawProjectDataSchema).safeParse(merged);
  if (!validated.success) {
    throw new Error('Invalid subgraph payload');
  }
  return validated.data;
}
