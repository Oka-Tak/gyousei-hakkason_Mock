import { getSupabase } from './supabaseClient';

type RecipientAgg = {
  recipient_name: string;
  corporate_number: string | null;
  total_amount: number;
  projects_count: number;
};

const RECIPIENT_TTL_MS = Number(process.env.RECIPIENT_TTL_MS || 10 * 60 * 1000);
const recipientCache = new Map<string, { at: number; data: RecipientAgg[] }>();

export async function fetchTopRecipientsByAgency(agencyName: string, limit = 10): Promise<RecipientAgg[]> {
  const key = `${agencyName}::${limit}`;
  const now = Date.now();
  const cached = recipientCache.get(key);
  if (cached && now - cached.at < RECIPIENT_TTL_MS) return cached.data;

  const supabase = getSupabase();
  // Resolve agency -> organizations
  const { data: agencies, error: aErr } = await supabase
    .from('agency')
    .select('agency_id, agency_name')
    .eq('agency_name', agencyName);
  if (aErr) throw aErr;
  if (!agencies?.length) return [];
  const agencyIds = agencies.map(a => a.agency_id);

  const { data: orgs, error: oErr } = await supabase
    .from('organization')
    .select('organization_id, agency_id')
    .in('agency_id', agencyIds);
  if (oErr) throw oErr;
  if (!orgs?.length) return [];
  const orgIds = orgs.map(o => o.organization_id);

  const { data: projects, error: pErr } = await supabase
    .from('project')
    .select('project_id, organization_id, budget_year')
    .in('organization_id', orgIds)
    .eq('budget_year', 2024);
  if (pErr) throw pErr;
  if (!projects?.length) return [];
  const projectIds = projects.map(p => p.project_id);

  const { data: blocks, error: bErr } = await supabase
    .from('project_spending_block')
    .select('block_id, project_id')
    .in('project_id', projectIds);
  if (bErr) throw bErr;
  if (!blocks?.length) return [];
  const blockIds = blocks.map(b => b.block_id);
  const projectByBlock = new Map<number, number>();
  blocks.forEach(b => projectByBlock.set(b.block_id, b.project_id));

  const { data: spendings, error: sErr } = await supabase
    .from('project_spending')
    .select('block_id, recipient_name, corporate_number, amount')
    .in('block_id', blockIds);
  if (sErr) throw sErr;

  const agg = new Map<string, { name: string; corp: string | null; total: number; projects: Set<number> }>();
  (spendings || []).forEach(sp => {
    const name: string = sp.recipient_name || '不明';
    const corp = (sp.corporate_number as string | null) || null;
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

type CompanyOverview = {
  recipient_name: string;
  corporate_number: string | null;
  total_amount: number;
  projects_count: number;
  by_agency: Array<{ name: string; value: number }>;
  by_year: Array<{ year: number; value: number }>;
  contract_methods: Array<{ name: string; count: number; value: number }>;
};

const COMPANY_TTL_MS = Number(process.env.COMPANY_TTL_MS || 10 * 60 * 1000);
const companyCache = new Map<string, { at: number; data: CompanyOverview | null }>();

export async function fetchCompanyOverview(input: { corporate_number?: string; name?: string; limit?: number }): Promise<CompanyOverview | null> {
  const key = JSON.stringify(input);
  const now = Date.now();
  const cached = companyCache.get(key);
  if (cached && now - cached.at < COMPANY_TTL_MS) return cached.data;

  const { corporate_number, name } = input;
  if (!corporate_number && !name) return null;

  const supabase = getSupabase();
  // 1) fetch spendings filtered by corp or name
  let spQuery = supabase
    .from('project_spending')
    .select('block_id, recipient_name, corporate_number, amount, contract_method')
    .limit(10000);
  if (corporate_number) spQuery = spQuery.eq('corporate_number', corporate_number);
  else if (name) spQuery = spQuery.ilike('recipient_name', `%${name}%`);
  const { data: spendings, error: spErr } = await spQuery;
  if (spErr) throw spErr;
  if (!spendings?.length) { companyCache.set(key, { at: now, data: null }); return null; }

  const blockIds = Array.from(new Set(spendings.map(s => s.block_id as number))).slice(0, 10000);
  const { data: blocks, error: bErr } = await supabase
    .from('project_spending_block')
    .select('block_id, project_id')
    .in('block_id', blockIds);
  if (bErr) throw bErr;
  if (!blocks?.length) { companyCache.set(key, { at: now, data: null }); return null; }
  const projectByBlock = new Map<number, number>();
  const projectIds = new Set<number>();
  blocks.forEach(b => { projectByBlock.set(b.block_id as number, b.project_id as number); projectIds.add(b.project_id as number); });

  const { data: projects, error: pErr } = await supabase
    .from('project')
    .select('project_id, organization_id, budget_year')
    .in('project_id', Array.from(projectIds));
  if (pErr) throw pErr;
  const orgIds = Array.from(new Set((projects || []).map(p => p.organization_id as string)));

  const { data: orgs, error: oErr } = await supabase
    .from('organization')
    .select('organization_id, agency_id')
    .in('organization_id', orgIds);
  if (oErr) throw oErr;
  const agencyIds = Array.from(new Set((orgs || []).map(o => o.agency_id as string)));

  const { data: agencies, error: aErr } = await supabase
    .from('agency')
    .select('agency_id, agency_name')
    .in('agency_id', agencyIds);
  if (aErr) throw aErr;

  const orgById = new Map<string, any>();
  (orgs || []).forEach(o => orgById.set(o.organization_id as string, o));
  const agencyById = new Map<string, any>();
  (agencies || []).forEach(a => agencyById.set(a.agency_id as string, a));
  const projectById = new Map<number, any>();
  (projects || []).forEach(p => projectById.set(p.project_id as number, p));

  // Aggregations
  let total = 0;
  const byAgency = new Map<string, number>();
  const byYear = new Map<number, number>();
  const byContract = new Map<string, { count: number; value: number }>();
  spendings.forEach(sp => {
    const amount = Number(sp.amount || 0);
    total += amount;
    const pid = projectByBlock.get(sp.block_id as number);
    const pj = pid != null ? projectById.get(pid) : null;
    const year = pj?.budget_year as number | undefined;
    if (year != null) byYear.set(year, (byYear.get(year) || 0) + amount);
    const org = pj ? orgById.get(pj.organization_id as string) : null;
    const ag = org ? agencyById.get(org.agency_id as string) : null;
    const agName = ag?.agency_name || '不明';
    byAgency.set(agName, (byAgency.get(agName) || 0) + amount);
    const cm = (sp.contract_method as string) || '不明';
    const prev = byContract.get(cm) || { count: 0, value: 0 };
    byContract.set(cm, { count: prev.count + 1, value: prev.value + amount });
  });

  const firstSp = spendings[0];
  const nameFinal = firstSp.recipient_name as string;
  const cnFinal = (firstSp.corporate_number as string | null) || null;
  const overview: CompanyOverview = {
    recipient_name: nameFinal,
    corporate_number: cnFinal,
    total_amount: total,
    projects_count: projectIds.size,
    by_agency: Array.from(byAgency.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, input.limit ?? 6),
    by_year: Array.from(byYear.entries()).map(([year, value]) => ({ year: Number(year), value })).sort((a, b) => a.year - b.year),
    contract_methods: Array.from(byContract.entries()).map(([name, v]) => ({ name, count: v.count, value: v.value })).sort((a, b) => b.value - a.value).slice(0, 6),
  };

  companyCache.set(key, { at: Date.now(), data: overview });
  return overview;
}

