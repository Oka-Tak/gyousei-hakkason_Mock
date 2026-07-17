import assert from 'node:assert/strict';
import test from 'node:test';
import type { BudgetReadRepository } from './budgetReadRepository';
import { getMainBudgetData } from './getMainBudgetData';

test('getMainBudgetData joins hierarchy data and calculates the project budget', async () => {
  const repository: BudgetReadRepository = {
    listProjects: async () => [{
      project_id: 10,
      project_name: '地域支援',
      budget_year: 2024,
      project_year: 2024,
      organization_id: 'org-1',
      initial_budget_total: 100,
      adjustment_total: 20,
      carryover_from_previous_total: 5,
      contingency_total: null,
    }],
    findOrganizationsByIds: async () => [{
      organization_id: 'org-1',
      agency_id: 'agency-1',
      bureau_office: '大臣官房',
      division: '会計課',
    }],
    findAgenciesByIds: async () => [{
      agency_id: 'agency-1',
      agency_name: '総務省',
      ministry_name: null,
    }],
  };

  const [row] = await getMainBudgetData(repository, { budgetYear: 2024, limit: 100 });
  assert.equal(row.total_budget, 125);
  assert.equal(row.agency_name, '総務省');
  assert.equal(row.ministry_name, '総務省');
  assert.equal(row.bureau_agency, '大臣官房');
  assert.equal(row.division, '会計課');
});
