import { z } from 'zod';

// SpendingItemのZodスキーマ
export const SpendingItemSchema = z.object({
  initial_budget_total: z.number().optional(),
  adjustment_total: z.number().optional(),
  carryover_from_previous_total: z.number().optional(),
  contingency_total: z.number().optional(),
  recipient_name: z.string().optional(),
  corporate_number: z.string().optional(),
  amount: z.number().optional(),
  block_name: z.string().optional(),
});

// RawProjectDataのZodスキーマ
export const RawProjectDataSchema = z.object({
  project_id: z.string().optional(),
  budget_year: z.number().optional(),
  project_year: z.number().optional(),
  organization_id: z.string().optional(),
  initial_budget_total: z.number().optional(),
  adjustment_total: z.number().optional(),
  carryover_from_previous_total: z.number().optional(),
  contingency_total: z.number().optional(),
  agency_name: z.string().optional(),
  ministry_name: z.string().optional(),
  agency_name_yomi: z.string().optional(),
  ministry_name_yomi: z.string().optional(),
  bureau_agency: z.string().optional(),
  bureau_agency_yomi: z.string().optional(),
  department: z.string().optional(),
  department_yomi: z.string().optional(),
  division: z.string().optional(),
  division_yomi: z.string().optional(),
  office: z.string().optional(),
  office_yomi: z.string().optional(),
  section: z.string().optional(),
  section_yomi: z.string().optional(),
  group: z.string().optional(),
  group_yomi: z.string().optional(),
  team: z.string().optional(),
  team_yomi: z.string().optional(),
  project_name: z.string().optional(),
  project_name_yomi: z.string().optional(),
  review_sheet_url: z.string().optional(),
  spending_list: z.array(SpendingItemSchema).optional(),
  initial_budget: z.number().optional(),
}).passthrough(); // インデックスシグネチャに対応するため、不明なプロパティを許可
