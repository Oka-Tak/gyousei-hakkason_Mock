import { z } from 'zod';

// SpendingItemのZodスキーマ
const SpendingItemSchema = z.object({
  initial_budget_total: z.number().nullable().optional(),
  adjustment_total: z.number().nullable().optional(),
  carryover_from_previous_total: z.number().nullable().optional(),
  contingency_total: z.number().nullable().optional(),
  recipient_name: z.string().nullable().optional(),
  corporate_number: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  block_name: z.string().nullable().optional(),
});

// RawProjectDataのZodスキーマ
// ゆるめのスキーマ（APIの実データには number/null が混在するため）
const Str = z.string().nullable().optional();
const StrNum = z.union([z.string(), z.number()]).nullable().optional();

export const RawProjectDataSchema = z.object({
  project_id: StrNum,
  budget_year: z.number().optional(),
  project_year: z.number().optional(),
  organization_id: StrNum,
  initial_budget_total: z.number().nullable().optional(),
  adjustment_total: z.number().nullable().optional(),
  carryover_from_previous_total: z.number().nullable().optional(),
  contingency_total: z.number().nullable().optional(),
  agency_name: Str,
  ministry_name: Str,
  agency_name_yomi: Str,
  ministry_name_yomi: Str,
  bureau_agency: Str,
  bureau_agency_yomi: Str,
  department: Str,
  department_yomi: Str,
  division: Str,
  division_yomi: Str,
  office: Str,
  office_yomi: Str,
  section: Str,
  section_yomi: Str,
  group: Str,
  group_yomi: Str,
  team: Str,
  team_yomi: Str,
  project_name: Str,
  project_name_yomi: Str,
  review_sheet_url: Str,
  spending_list: z.array(SpendingItemSchema).optional(),
  initial_budget: z.number().optional(),
  total_budget: z.number().optional(),
});
