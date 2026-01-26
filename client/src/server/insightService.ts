import { getSupabase } from './supabaseClient';
import { CACHE_TTL, QUERY_LIMITS, PAGINATION, BUDGET_YEAR } from './constants';

type AgencyRow = {
  agency_id: string;
  agency_name: string | null;
};

type OrganizationRow = {
  organization_id: string;
  agency_id: string | null;
};

type ProjectRow = {
  project_id: number;
  organization_id: string | null;
  budget_year: number | null;
};

type SpendingBlockRow = {
  block_id: number;
  project_id: number;
};

type SpendingRow = {
  block_id: number;
  recipient_name: string;
  corporate_number: string | null;
  amount: number | null;
  contract_method?: string | null;
};

type RecipientAgg = {
  recipient_name: string;
  corporate_number: string | null;
  total_amount: number;
  projects_count: number;
};

const recipientCache = new Map<string, { at: number; data: RecipientAgg[] }>();

export async function fetchTopRecipientsByAgency(agencyName: string, limit = PAGINATION.DEFAULT_LIMIT): Promise<RecipientAgg[]> {
  const key = `${agencyName}::${limit}`;
  const now = Date.now();
  const cached = recipientCache.get(key);
  if (cached && now - cached.at < CACHE_TTL.RECIPIENT) return cached.data;

  const supabase = getSupabase();
  // Resolve agency -> organizations
  const { data: agencies, error: aErr } = await supabase
    .from('agency')
    .select('agency_id, agency_name')
    .eq('agency_name', agencyName);
  if (aErr) throw aErr;
  const agencyRows = (agencies ?? []) as AgencyRow[];
  if (!agencyRows.length) return [];
  const agencyIds = agencyRows.map(a => a.agency_id);

  const { data: orgs, error: oErr } = await supabase
    .from('organization')
    .select('organization_id, agency_id')
    .in('agency_id', agencyIds);
  if (oErr) throw oErr;
  const orgRows = (orgs ?? []) as OrganizationRow[];
  if (!orgRows.length) return [];
  const orgIds = orgRows.map(o => o.organization_id);

  const { data: projects, error: pErr } = await supabase
    .from('project')
    .select('project_id, organization_id, budget_year')
    .in('organization_id', orgIds)
    .eq('budget_year', BUDGET_YEAR.CURRENT);
  if (pErr) throw pErr;
  const projectRows = (projects ?? []) as ProjectRow[];
  if (!projectRows.length) return [];
  const projectIds = projectRows.map(p => p.project_id);

  const { data: blocks, error: bErr } = await supabase
    .from('project_spending_block')
    .select('block_id, project_id')
    .in('project_id', projectIds);
  if (bErr) throw bErr;
  const blockRows = (blocks ?? []) as SpendingBlockRow[];
  if (!blockRows.length) return [];
  const blockIds = blockRows.map(b => b.block_id);
  const projectByBlock = new Map<number, number>();
  blockRows.forEach(b => projectByBlock.set(b.block_id, b.project_id));

  const { data: spendings, error: sErr } = await supabase
    .from('project_spending')
    .select('block_id, recipient_name, corporate_number, amount')
    .in('block_id', blockIds);
  if (sErr) throw sErr;

  const agg = new Map<string, { name: string; corp: string | null; total: number; projects: Set<number> }>();
  const spendingRows = (spendings ?? []) as SpendingRow[];
  spendingRows.forEach(sp => {
    const name: string = sp.recipient_name || '不明';
    const corp = sp.corporate_number || null;
    const key2 = `${name}::${corp ?? ''}`;
    if (!agg.has(key2)) agg.set(key2, { name, corp, total: 0, projects: new Set<number>() });
    const rec = agg.get(key2)!;
    rec.total += Number(sp.amount || 0);
    const pid = projectByBlock.get(sp.block_id as number);
    if (pid != null) rec.projects.add(pid);
  });

  const result: RecipientAgg[] = Array.from(agg.values())
    .map(r => ({ recipient_name: r.name, corporate_number: r.corp, total_amount: r.total, projects_count: r.projects.size }))
    .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
    .slice(0, limit);

  recipientCache.set(key, { at: Date.now(), data: result });
  return result;
}

export async function fetchTopRecipientsByProject(projectId: number, limit = PAGINATION.DEFAULT_LIMIT): Promise<RecipientAgg[]> {
  const numericId = Number(projectId);
  const key = `project::${numericId}::${limit}`;
  const now = Date.now();
  const cached = recipientCache.get(key);
  if (cached && now - cached.at < CACHE_TTL.RECIPIENT) return cached.data;

  if (!Number.isFinite(numericId)) {
    throw new Error('Invalid project id for recipient lookup');
  }

  const supabase = getSupabase();

  const { data: blocks, error: blockErr } = await supabase
    .from('project_spending_block')
    .select('block_id')
    .eq('project_id', numericId);
  if (blockErr) throw blockErr;
  const blockRows = (blocks ?? []) as SpendingBlockRow[];
  if (!blockRows.length) {
    recipientCache.set(key, { at: now, data: [] });
    return [];
  }
  const blockIds = blockRows.map(b => b.block_id);

  const { data: spendings, error: spendErr } = await supabase
    .from('project_spending')
    .select('block_id, recipient_name, corporate_number, amount')
    .in('block_id', blockIds);
  if (spendErr) throw spendErr;

  const agg = new Map<string, { name: string; corp: string | null; total: number }>();
  const spendingRows = (spendings ?? []) as SpendingRow[];
  spendingRows.forEach((sp) => {
    const name = sp.recipient_name || '不明';
    const corp = sp.corporate_number || null;
    const key2 = `${name}::${corp ?? ''}`;
    if (!agg.has(key2)) agg.set(key2, { name, corp, total: 0 });
    const rec = agg.get(key2)!;
    rec.total += Number(sp.amount || 0);
  });

  const result: RecipientAgg[] = Array.from(agg.values())
    .map(r => ({ recipient_name: r.name, corporate_number: r.corp, total_amount: r.total, projects_count: spendingRows.length ? 1 : 0 }))
    .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
    .slice(0, limit);

  recipientCache.set(key, { at: Date.now(), data: result });
  return result;
}

type CompanyOverview = {
  recipient_name: string;
  corporate_number: string | null;
  total_amount: number;
  projects_count: number;
  by_agency: Array<{ name: string; value: number }>;
  by_year: Array<{ year: number; value: number }>;
  contract_methods: Array<{ name: string; count: number; value: number }>;
};

const companyCache = new Map<string, { at: number; data: CompanyOverview | null }>();

export async function fetchCompanyOverview(input: { corporate_number?: string; name?: string; limit?: number }): Promise<CompanyOverview | null> {
  const key = JSON.stringify(input);
  const now = Date.now();
  const cached = companyCache.get(key);
  if (cached && now - cached.at < CACHE_TTL.COMPANY) return cached.data;

  const { corporate_number, name } = input;
  if (!corporate_number && !name) return null;

  const supabase = getSupabase();
  // 1) fetch spendings filtered by corp or name
  let spQuery = supabase
    .from('project_spending')
    .select('block_id, recipient_name, corporate_number, amount, contract_method')
    .limit(QUERY_LIMITS.COMPANY_SPENDING);
  if (corporate_number) spQuery = spQuery.eq('corporate_number', corporate_number);
  else if (name) spQuery = spQuery.ilike('recipient_name', `%${name}%`);
  const { data: spendings, error: spErr } = await spQuery;
  if (spErr) throw spErr;
  const spendingRows = (spendings ?? []) as SpendingRow[];
  if (!spendingRows.length) { companyCache.set(key, { at: now, data: null }); return null; }

  const blockIds = Array.from(new Set(spendingRows.map(s => s.block_id))).slice(0, QUERY_LIMITS.COMPANY_BLOCKS);
  const { data: blocks, error: bErr } = await supabase
    .from('project_spending_block')
    .select('block_id, project_id')
    .in('block_id', blockIds);
  if (bErr) throw bErr;
  const blockRows = (blocks ?? []) as SpendingBlockRow[];
  if (!blockRows.length) { companyCache.set(key, { at: now, data: null }); return null; }
  const projectByBlock = new Map<number, number>();
  const projectIds = new Set<number>();
  blockRows.forEach(b => { projectByBlock.set(b.block_id, b.project_id); projectIds.add(b.project_id); });

  const { data: projects, error: pErr } = await supabase
    .from('project')
    .select('project_id, organization_id, budget_year')
    .in('project_id', Array.from(projectIds));
  if (pErr) throw pErr;
  const projectRows = (projects ?? []) as ProjectRow[];
  const orgIds = Array.from(new Set(projectRows.map(p => p.organization_id).filter((id): id is string => !!id)));

  const { data: orgs, error: oErr } = await supabase
    .from('organization')
    .select('organization_id, agency_id')
    .in('organization_id', orgIds);
  if (oErr) throw oErr;
  const orgRows = (orgs ?? []) as OrganizationRow[];
  const agencyIds = Array.from(new Set(orgRows.map(o => o.agency_id).filter((id): id is string => !!id)));

  const { data: agencies, error: aErr } = await supabase
    .from('agency')
    .select('agency_id, agency_name')
    .in('agency_id', agencyIds);
  if (aErr) throw aErr;

  const agencyRows = (agencies ?? []) as AgencyRow[];

  const orgById = new Map<string, OrganizationRow>();
  orgRows.forEach(o => orgById.set(o.organization_id, o));
  const agencyById = new Map<string, AgencyRow>();
  agencyRows.forEach(a => agencyById.set(a.agency_id, a));
  const projectById = new Map<number, ProjectRow>();
  projectRows.forEach(p => projectById.set(p.project_id, p));

  // Aggregations
  let total = 0;
  const byAgency = new Map<string, number>();
  const byYear = new Map<number, number>();
  const byContract = new Map<string, { count: number; value: number }>();
  spendingRows.forEach(sp => {
    const amount = Number(sp.amount || 0);
    total += amount;
    const pid = projectByBlock.get(sp.block_id);
    const pj = pid != null ? projectById.get(pid) : null;
    const year = pj?.budget_year as number | undefined;
    if (year != null) byYear.set(year, (byYear.get(year) || 0) + amount);
    const org = pj && pj.organization_id ? orgById.get(pj.organization_id) : null;
    const ag = org && org.agency_id ? agencyById.get(org.agency_id) : null;
    const agName = ag?.agency_name || '不明';
    byAgency.set(agName, (byAgency.get(agName) || 0) + amount);
    const cm = sp.contract_method || '不明';
    const prev = byContract.get(cm) || { count: 0, value: 0 };
    byContract.set(cm, { count: prev.count + 1, value: prev.value + amount });
  });

  const firstSp = spendingRows[0];
  const nameFinal = firstSp.recipient_name;
  const cnFinal = firstSp.corporate_number || null;
  const overview: CompanyOverview = {
    recipient_name: nameFinal,
    corporate_number: cnFinal,
    total_amount: total,
    projects_count: projectIds.size,
    by_agency: Array.from(byAgency.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, input.limit ?? PAGINATION.TOP_RESULTS_LIMIT),
    by_year: Array.from(byYear.entries()).map(([year, value]) => ({ year: Number(year), value })).sort((a, b) => a.year - b.year),
    contract_methods: Array.from(byContract.entries()).map(([name, v]) => ({ name, count: v.count, value: v.value })).sort((a, b) => b.value - a.value).slice(0, PAGINATION.TOP_RESULTS_LIMIT),
  };

  companyCache.set(key, { at: Date.now(), data: overview });
  return overview;
}
