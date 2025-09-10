// データベースから取得される生データの型定義
export interface RawProjectData {
  project_id?: string;
  budget_year?: number;
  project_year?: number;
  organization_id?: string;
  initial_budget_total?: number;
  adjustment_total?: number;
  carryover_from_previous_total?: number;
  contingency_total?: number;
  agency_name?: string;
  ministry_name?: string;
  agency_name_yomi?: string;
  ministry_name_yomi?: string;
  bureau_agency?: string;
  bureau_agency_yomi?: string;
  department?: string;
  department_yomi?: string;
  division?: string;
  division_yomi?: string;
  office?: string;
  office_yomi?: string;
  section?: string;
  section_yomi?: string;
  group?: string;
  group_yomi?: string;
  team?: string;
  team_yomi?: string;
  project_name?: string;
  project_name_yomi?: string;
  review_sheet_url?: string;
  spending_list?: SpendingItem[];
  initial_budget?: number;
  // インデックスシグネチャを追加
  [key: string]: any;
}

// ノードの型定義（グラフ表示用）
export interface GraphNode {
  id: string;
  name: string;
  group: string;
  topLevel: string;
  spending_list?: SpendingItem[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

// リンクの型定義（グラフ表示用）
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
}

// 支出項目の型定義
export interface SpendingItem {
  initial_budget_total?: number;
  adjustment_total?: number;
  carryover_from_previous_total?: number;
  contingency_total?: number;
  recipient_name?: string;
  corporate_number?: string;
  amount?: number;
  block_name?: string;
}

// D3のイベント型定義
export interface D3DragEvent {
  x: number;
  y: number;
  dx: number;
  dy: number;
  subject: Node;
}

// APIレスポンスの型定義
export interface ApiResponse<T> {
  data: T[];
  error?: string;
}

// ズーム変換の型定義（D3用）
export interface ZoomTransform {
  x: number;
  y: number;
  k: number;
}

// 検索結果の型定義
export interface SearchResult {
  item: Node;
  refIndex: number;
}

// Kuromoji トークナイザーの型定義
export interface KuromojiToken {
  surface_form: string;
  reading?: string;
}

export interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}