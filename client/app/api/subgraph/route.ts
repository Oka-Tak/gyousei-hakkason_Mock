import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RawProjectDataSchema } from '@/types/schemas';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 入力スキーマの定義
const SubgraphInputSchema = z.object({
  node: z.string().min(1, 'node parameter is required'),
});

export async function GET(request: Request) {
  try {
    // URLパラメータからnodeIdを取得
    const { searchParams } = new URL(request.url);
    const input = SubgraphInputSchema.safeParse({ node: searchParams.get('node') });

    if (!input.success) {
      return NextResponse.json({ error: input.error.issues }, { status: 400 });
    }

    const nodeId = input.data.node;

    // nodeIdを分解して組織階層を特定
    const hierarchyParts = decodeURIComponent(nodeId).split('→');
    const topLevelOrg = hierarchyParts[0]; // 最上位組織（省庁名）
    
    
    // 該当する組織のみを取得するため、まずagencyを絞り込み
    // agency_nameのみで検索（ministry_nameカラムが存在しないため）
    const { data: uniqueAgencies, error: agencyError } = await supabase
      .from('agency')
      .select('*')
      .eq('agency_name', topLevelOrg);
      
    if (agencyError) throw agencyError;
    
    if (!uniqueAgencies || uniqueAgencies.length === 0) {
      return NextResponse.json({ error: 'No matching agency found' }, { status: 404 });
    }
    
    const agencyIds = uniqueAgencies.map(a => a.agency_id);
    
    // 該当agencyに属するorganizationのみ取得
    const { data: organizations, error: orgError } = await supabase
      .from('organization')
      .select('*')
      .in('agency_id', agencyIds);
    if (orgError) throw orgError;
    
    if (!organizations || organizations.length === 0) {
      return NextResponse.json([]);
    }
    
    const organizationIds = organizations.map(o => o.organization_id);
    
    // 該当organizationのprojectのみ取得（2024年度限定）
    const { data: projects, error: pError } = await supabase
      .from('project')
      .select('*')
      .in('organization_id', organizationIds)
      .eq('budget_year', 2024);
    if (pError) throw pError;
    
    if (!projects || projects.length === 0) {
      return NextResponse.json([]);
    }
    
    const projectIds = projects.map(p => p.project_id);
    
    // 該当projectのproject_spending_blockのみ取得（大量データ対策でLIMIT追加）
    const { data: projectSpendingBlocks, error: psbError } = await supabase
      .from('project_spending_block')
      .select('*')
      .in('project_id', projectIds)
      .limit(3000); // 厚生労働省対策
          if (psbError) throw psbError;
    
    const blockIds = (projectSpendingBlocks || []).map(b => b.block_id);
    
    // 大量データ対策: block_idを最初の1000件に制限してからクエリ
    const limitedBlockIds = blockIds.slice(0, 1000);
    
    // 該当blockのproject_spendingのみ取得（大量データ対策でLIMIT追加）
    const { data: projectSpendings, error: psError } = limitedBlockIds.length > 0 
      ? await supabase
          .from('project_spending')
          .select('*')
          .in('block_id', limitedBlockIds)
          .limit(5000)  // 厚生労働省の大量データ対策
      : { data: [], error: null };
    if (psError) throw psError;

    // project_id→project, block_id→block, organization_id→organization, agency_id→agency
    const projectMap = new Map();
    (projects || []).forEach((p: any) => projectMap.set(p.project_id, p));
    const blockMap = new Map();
    (projectSpendingBlocks || []).forEach((b: any) => blockMap.set(b.block_id, b));
    const orgMap = new Map();
    (organizations || []).forEach((o: any) => orgMap.set(o.organization_id, o));
    const agencyMap = new Map();
    (uniqueAgencies || []).forEach((a: any) => agencyMap.set(a.agency_id, a));

    // blockごとにspending_listを集約
    const blockSpendingMap = new Map();
    (projectSpendings || []).forEach((ps: any) => {
      if (!blockSpendingMap.has(ps.block_id)) blockSpendingMap.set(ps.block_id, []);
      blockSpendingMap.get(ps.block_id).push(ps);
    });

    // block単位でデータを組み立て
    const merged = (projectSpendingBlocks || []).map((block: any) => {
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
    
    // 出力データの検証
    const validatedMerged = z.array(RawProjectDataSchema).safeParse(merged);

    if (!validatedMerged.success) {
      console.error('Subgraph API output validation error:', validatedMerged.error);
      return NextResponse.json({ error: 'Internal server error: Invalid data format' }, { status: 500 });
    }

    return NextResponse.json(validatedMerged.data);
  } catch (error: unknown) {
    console.error('Subgraph API error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
