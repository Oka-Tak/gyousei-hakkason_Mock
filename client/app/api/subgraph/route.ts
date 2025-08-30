import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    // 各テーブル全件取得
    const { data: projectSpending, error: psError } = await supabase
      .from('project_spending')
      .select('*');
    if (psError) throw psError;

    const { data: projectSpendingBlock, error: psbError } = await supabase
      .from('project_spending_block')
      .select('*');
    if (psbError) throw psbError;

    const { data: project, error: pError } = await supabase
      .from('project')
      .select('*');
    if (pError) throw pError;

    const { data: organization, error: orgError } = await supabase
      .from('organization')
      .select('*');
    if (orgError) throw orgError;

    const { data: agency, error: agencyError } = await supabase
      .from('agency')
      .select('*');
    if (agencyError) throw agencyError;

    // project_id→project, block_id→block, organization_id→organization, agency_id→agency
    const projectMap = new Map();
    (project || []).forEach((p: any) => projectMap.set(p.project_id, p));
    const blockMap = new Map();
    (projectSpendingBlock || []).forEach((b: any) => blockMap.set(b.block_id, b));
    const orgMap = new Map();
    (organization || []).forEach((o: any) => orgMap.set(o.organization_id, o));
    const agencyMap = new Map();
    (agency || []).forEach((a: any) => agencyMap.set(a.agency_id, a));

    // blockごとにspending_listを集約
    const blockSpendingMap = new Map();
    (projectSpending || []).forEach((ps: any) => {
      if (!blockSpendingMap.has(ps.block_id)) blockSpendingMap.set(ps.block_id, []);
      blockSpendingMap.get(ps.block_id).push(ps);
    });

    // block単位でデータを組み立て
    const merged = (projectSpendingBlock || []).map((block: any) => {
      const proj = projectMap.get(block.project_id) || {};
      const org = orgMap.get(proj.organization_id) || {};
      const ag = agencyMap.get(org.agency_id) || {};
      const spending_list = blockSpendingMap.get(block.block_id) || [];
      // block, project, spending から金額を優先的に取得
      const initial_budget_total =
        block.block_total_amount ??
        proj.initial_budget_total ??
        0;
      return {
        ...block,
        ...proj,
        agency_id: ag.agency_id,
        agency_name: ag.agency_name,
        agency_order: ag.agency_order,
        ministry_name: ag.ministry_name || ag.agency_name,
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
    return NextResponse.json(merged);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
