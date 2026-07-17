import { calculateTotalBudget } from '../domain/budget';
import type {
  AgencyRecord,
  BudgetReadRepository,
  OrganizationRecord,
} from './budgetReadRepository';

export interface MainBudgetDataRow {
  project_id: number;
  project_name: string | null;
  budget_year: number | null;
  project_year: number | null;
  organization_id: string | null;
  initial_budget_total: number | null;
  adjustment_total: number | null;
  carryover_from_previous_total: number | null;
  contingency_total: number | null;
  agency_id?: string;
  agency_name?: string | null;
  agency_order?: number | null;
  ministry_name?: string | null;
  bureau_agency?: string | null;
  department?: string | null;
  division?: string | null;
  office?: string | null;
  section?: string | null;
  group?: string | null;
  team?: string | null;
  total_budget: number;
}

function indexOrganizations(rows: readonly OrganizationRecord[]): Map<string, OrganizationRecord> {
  return new Map(rows.map((row) => [row.organization_id, row]));
}

function indexAgencies(rows: readonly AgencyRecord[]): Map<string, AgencyRecord> {
  return new Map(rows.map((row) => [row.agency_id, row]));
}

export async function getMainBudgetData(
  repository: BudgetReadRepository,
  input: { budgetYear: number; limit: number },
): Promise<MainBudgetDataRow[]> {
  const projects = await repository.listProjects(input);
  if (projects.length === 0) return [];

  const organizationIds = [...new Set(
    projects.map((project) => project.organization_id).filter((id): id is string => Boolean(id)),
  )];
  const organizations = organizationIds.length
    ? await repository.findOrganizationsByIds(organizationIds)
    : [];
  const agencyIds = [...new Set(
    organizations.map((organization) => organization.agency_id).filter((id): id is string => Boolean(id)),
  )];
  const agencies = agencyIds.length ? await repository.findAgenciesByIds(agencyIds) : [];
  const organizationById = indexOrganizations(organizations);
  const agencyById = indexAgencies(agencies);

  return projects.map((project) => {
    const organization = project.organization_id
      ? organizationById.get(project.organization_id)
      : undefined;
    const agency = organization?.agency_id ? agencyById.get(organization.agency_id) : undefined;
    return {
      ...project,
      agency_id: agency?.agency_id,
      agency_name: agency?.agency_name,
      agency_order: agency?.agency_order,
      ministry_name: agency?.ministry_name || agency?.agency_name,
      bureau_agency: organization?.bureau_office,
      department: organization?.department,
      division: organization?.division,
      office: organization?.unit,
      section: organization?.section,
      group: organization?.group,
      team: organization?.team,
      total_budget: calculateTotalBudget({
        initial: project.initial_budget_total,
        adjustment: project.adjustment_total,
        carryover: project.carryover_from_previous_total,
        contingency: project.contingency_total,
      }),
    };
  });
}
