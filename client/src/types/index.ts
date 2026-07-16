// データベースから取得される生データの型定義
export interface RawProjectData {
  project_id?: string | number | null;
  budget_year?: number | null;
  project_year?: number | null;
  organization_id?: string | number | null;
  initial_budget_total?: number | null;
  adjustment_total?: number | null;
  carryover_from_previous_total?: number | null;
  contingency_total?: number | null;
  agency_name?: string | null;
  ministry_name?: string | null;
  agency_name_yomi?: string | null;
  ministry_name_yomi?: string | null;
  bureau_agency?: string | null;
  bureau_agency_yomi?: string | null;
  department?: string | null;
  department_yomi?: string | null;
  division?: string | null;
  division_yomi?: string | null;
  office?: string | null;
  office_yomi?: string | null;
  section?: string | null;
  section_yomi?: string | null;
  group?: string | null;
  group_yomi?: string | null;
  team?: string | null;
  team_yomi?: string | null;
  project_name?: string | null;
  project_name_yomi?: string | null;
  review_sheet_url?: string | null;
  spending_list?: SpendingItem[];
  initial_budget?: number;
  total_budget?: number;
}

// 支出項目の型定義
export interface SpendingItem {
  initial_budget_total?: number | null;
  adjustment_total?: number | null;
  carryover_from_previous_total?: number | null;
  contingency_total?: number | null;
  recipient_name?: string | null;
  corporate_number?: string | null;
  amount?: number | null;
  block_name?: string | null;
}
