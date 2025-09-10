import { getSupabase } from './supabaseClient';

export async function fetchSpendingByProject(projectId: string) {
  const supabase = getSupabase();
  // 1) get blocks for project
  const { data: blocks, error: bError } = await supabase
    .from('project_spending_block')
    .select('block_id')
    .eq('project_id', projectId);
  if (bError) throw bError;
  const blockIds = (blocks || []).map((b: any) => b.block_id);
  if (!blockIds.length) return [];

  // 2) get spendings for those blocks
  const { data: spendings, error: sError } = await supabase
    .from('project_spending')
    .select('block_id, recipient_name, corporate_number, amount')
    .in('block_id', blockIds)
    .limit(5000);
  if (sError) throw sError;
  return spendings || [];
}

