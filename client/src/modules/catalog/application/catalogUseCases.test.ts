import assert from 'node:assert/strict';
import test from 'node:test';
import { getProjectDetail, searchOutcomes, searchPolicies } from './catalogUseCases';
import type { CatalogRecord, ProjectCatalogRepository } from './projectCatalogRepository';

function repositoryWith(overrides: Partial<Record<keyof ProjectCatalogRepository, CatalogRecord[]>>): ProjectCatalogRepository {
  return {
    getProjectOverviews: () => overrides.getProjectOverviews ?? [],
    getPolicies: () => overrides.getPolicies ?? [],
    getSubsidies: () => overrides.getSubsidies ?? [],
    getRelatedProjects: () => overrides.getRelatedProjects ?? [],
    getKpiSeries: () => overrides.getKpiSeries ?? [],
    getKpiLinks: () => overrides.getKpiLinks ?? [],
  };
}

test('getProjectDetail selects the latest project overview', () => {
  const repository = repositoryWith({
    getProjectOverviews: [
      { 予算事業ID: '10', 事業年度: '2023', 事業名: '旧事業名' },
      { 予算事業ID: '10', 事業年度: '2024', 事業名: '現事業名' },
      { 予算事業ID: '11', 事業年度: '2025', 事業名: '別事業' },
    ],
  });

  const detail = getProjectDetail(repository, '10');
  assert.equal(detail.overview?.事業名, '現事業名');
});

test('searchOutcomes normalizes KPI values and applies project filtering', () => {
  const repository = repositoryWith({
    getKpiSeries: [
      {
        予算事業ID: '10',
        事業名: '地域支援',
        '種別（アクティビティ・アウトプット・アウトカム）': 'アウトカム',
        '活動指標／成果指標': '支援人数',
        単位: '万人',
        '改善の上向き／下向き': '上向き',
        '2024': '2',
      },
      {
        予算事業ID: '11',
        事業名: '別事業',
        '活動指標／成果指標': '対象外',
        単位: '件',
        '2024': '1',
      },
    ],
  });

  const outcomes = searchOutcomes(repository, { projectId: '10', query: '支援' });
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].series[0].value, 20_000);
  assert.equal(outcomes[0].unit_disp, '人');
});

test('searchPolicies searches across policy, law, and project names', () => {
  const repository = repositoryWith({
    getPolicies: [{
      予算事業ID: '10',
      事業名: '地域支援',
      政策: '地域活性化',
      法令名: '地域支援法',
    }],
  });

  assert.equal(searchPolicies(repository, '活性化').length, 1);
  assert.equal(searchPolicies(repository, '存在しない').length, 0);
});
