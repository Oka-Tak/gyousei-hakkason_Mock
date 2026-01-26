import { getSupabase } from './supabaseClient';
import { QUERY_LIMITS } from './constants';

type SpendingBlockRow = {
  block_id: number;
};

type SpendingRow = {
  block_id: number;
  recipient_name: string;
  corporate_number: string | null;
  amount: number | null;
};

export async function fetchSpendingByProject(projectId: string): Promise<SpendingRow[]> {
  const supabase = getSupabase();
  // 1) get blocks for project
  const { data: blocks, error: bError } = await supabase
    .from('project_spending_block')
    .select('block_id')
    .eq('project_id', projectId);
  if (bError) throw bError;
  const blockRows = (blocks || []) as SpendingBlockRow[];
  const blockIds = blockRows.map((b) => b.block_id);
  if (!blockIds.length) return [];

  // 2) get spendings for those blocks
  const { data: spendings, error: sError } = await supabase
    .from('project_spending')
    .select('block_id, recipient_name, corporate_number, amount')
    .in('block_id', blockIds)
    .limit(QUERY_LIMITS.SPENDING_BY_PROJECT);
  if (sError) throw sError;
  return (spendings || []) as SpendingRow[];
}

