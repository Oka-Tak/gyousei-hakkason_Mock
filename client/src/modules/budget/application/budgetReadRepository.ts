export interface BudgetProjectRecord {
  project_id: number;
  project_name: string | null;
  budget_year: number | null;
  project_year: number | null;
  organization_id: string | null;
  initial_budget_total: number | null;
  adjustment_total: number | null;
  carryover_from_previous_total: number | null;
  contingency_total: number | null;
}

export interface OrganizationRecord {
  organization_id: string;
  agency_id: string | null;
  bureau_office?: string | null;
  department?: string | null;
  division?: string | null;
  unit?: string | null;
  section?: string | null;
  group?: string | null;
  team?: string | null;
}

export interface AgencyRecord {
  agency_id: string;
  agency_name?: string | null;
  agency_order?: number | null;
  ministry_name?: string | null;
}

export interface BudgetReadRepository {
  listProjects(input: { budgetYear: number; limit: number }): Promise<BudgetProjectRecord[]>;
  findOrganizationsByIds(organizationIds: readonly string[]): Promise<OrganizationRecord[]>;
  findAgenciesByIds(agencyIds: readonly string[]): Promise<AgencyRecord[]>;
}
