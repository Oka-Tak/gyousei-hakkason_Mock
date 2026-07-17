import { getSupabase } from '@/server/supabaseClient';
import type {
  AgencyRecord,
  BudgetProjectRecord,
  BudgetReadRepository,
  OrganizationRecord,
} from '../application/budgetReadRepository';

export const supabaseBudgetReadRepository: BudgetReadRepository = {
  async listProjects({ budgetYear, limit }) {
    const { data, error } = await getSupabase()
      .from('project')
      .select('project_id, project_name, budget_year, project_year, organization_id, initial_budget_total, adjustment_total, carryover_from_previous_total, contingency_total')
      .eq('budget_year', budgetYear)
      .order('initial_budget_total', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as BudgetProjectRecord[];
  },

  async findOrganizationsByIds(organizationIds) {
    const { data, error } = await getSupabase()
      .from('organization')
      .select('organization_id, agency_id, bureau_office, department, division, unit, section, group, team')
      .in('organization_id', [...organizationIds]);
    if (error) throw error;
    return (data ?? []) as OrganizationRecord[];
  },

  async findAgenciesByIds(agencyIds) {
    const { data, error } = await getSupabase()
      .from('agency')
      .select('agency_id, agency_name, agency_order, ministry_name')
      .in('agency_id', [...agencyIds]);
    if (error) throw error;
    return (data ?? []) as AgencyRecord[];
  },
};
