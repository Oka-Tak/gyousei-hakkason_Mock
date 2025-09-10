import { z } from 'zod';
import { getSupabase } from './supabaseClient';
import { RawProjectDataSchema } from '@/types/schemas';

export async function fetchSubgraph(nodeId: string) {
  const supabase = getSupabase();
  const decoded = decodeURIComponent(nodeId);
  const topLevelOrg = decoded.split('→')[0];

  const { data: uniqueAgencies, error: agencyError } = await supabase
    .from('agency')
    .select('*')
    .eq('agency_name', topLevelOrg);
  if (agencyError) throw agencyError;
  if (!uniqueAgencies?.length) return [];

  const agencyIds = uniqueAgencies.map(a => a.agency_id);

  const { data: organizations, error: orgError } = await supabase
    .from('organization')
    .select('*')
    .in('agency_id', agencyIds);
  if (orgError) throw orgError;
  if (!organizations?.length) return [];

  const organizationIds = organizations.map(o => o.organization_id);

  const { data: projects, error: pError } = await supabase
    .from('project')
    .select('*')
    .in('organization_id', organizationIds)
    .eq('budget_year', 2024);
  if (pError) throw pError;
  if (!projects?.length) return [];

  const projectIds = projects.map(p => p.project_id);

  const { data: projectSpendingBlocks, error: psbError } = await supabase
    .from('project_spending_block')
    .select('*')
    .in('project_id', projectIds)
    .limit(3000);
  if (psbError) throw psbError;

  const blockIds = (projectSpendingBlocks || []).map((b: any) => b.project_spending_block_id);
  const { data: spendings, error: sError } = blockIds.length > 0
    ? await supabase.from('spending').select('*').in('project_spending_block_id', blockIds)
    : { data: [], error: null as any };
  if (sError) throw sError;

  const orgMap = new Map<string, any>();
  organizations.forEach(o => orgMap.set(o.organization_id, o));

  const projectMap = new Map<number, any>();
  (projects || []).forEach((p: any) => projectMap.set(p.project_id, p));

  const spendingByBlock = new Map<number, any[]>();
  (spendings || []).forEach(sp => {
    const k = sp.project_spending_block_id;
    if (!spendingByBlock.has(k)) spendingByBlock.set(k, []);
    spendingByBlock.get(k)!.push(sp);
  });

  const merged = (projectSpendingBlocks || []).map((block: any) => {
    const proj = projectMap.get(block.project_id) || {};
    const org = orgMap.get(proj.organization_id) || {};
    const initial_budget_total = block.block_total_amount ?? proj.initial_budget_total ?? 0;
    const spending_list = spendingByBlock.get(block.project_spending_block_id) || [];
    return {
      ...block,
      ...proj,
      agency_id: org.agency_id,
      ministry_name: null, // normalized by client if needed
      bureau_agency: org.bureau_office,
      department: org.department,
      division: org.division,
      office: org.unit,
      section: org.section,
      group: org.group,
      team: org.team,
      review_sheet_url: proj.review_sheet_url || '',
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

