import type {
  OutcomeItem,
  PolicyCatalogItem,
  ProjectDetail,
  ProjectKpi,
  ProjectPolicy,
} from '../domain/models';
import { normalizePercentSeries, normalizeUnit } from '../domain/unit';
import type { CatalogRecord, ProjectCatalogRepository } from './projectCatalogRepository';

const SERIES_YEARS = Array.from({ length: 2060 - 2007 + 1 }, (_, index) => String(2007 + index));

function projectIdOf(record: CatalogRecord): string {
  return record['予算事業ID'] || '';
}

function latestRecord(records: readonly CatalogRecord[]): CatalogRecord | null {
  return records.reduce<CatalogRecord | null>((latest, record) => {
    if (!latest) return record;
    const year = Number(record['事業年度'] || record['予算年度'] || 0);
    const latestYear = Number(latest['事業年度'] || latest['予算年度'] || 0);
    return year > latestYear ? record : latest;
  }, null);
}

function toProjectPolicy(record: CatalogRecord): ProjectPolicy {
  return {
    policy_no: record['番号（政策・施策）'],
    policy_ministry: record['政策所管府省庁_P'],
    policy: record['政策'],
    program: record['施策'],
    url: record['政策・施策URL'],
    law_no: record['番号（根拠法令）'],
    law_name: record['法令名'],
    law_id: record['法令ID'],
    law_article: record['条'],
    law_item: record['項'],
    law_clause: record['号・号の細分'],
    plan_no: record['番号（関係する計画・通知等）'],
    plan_name: record['計画通知名'],
    plan_url: record['計画通知等URL'],
  };
}

function toProjectKpi(record: CatalogRecord): ProjectKpi | null {
  const rawSeries = SERIES_YEARS.flatMap((year) => {
    const raw = (record[year] || '').replace(/,/g, '');
    if (!raw) return [];
    const value = Number(raw);
    return Number.isFinite(value) ? [{ year: Number(year), value }] : [];
  });
  if (!record['活動指標／成果指標']?.trim() || rawSeries.length === 0) return null;

  const unit = record['単位'] || '';
  const unitInfo = normalizeUnit(unit);
  let values = rawSeries.map(({ value }) => unitInfo.convert(value));
  let unitDisplay = unitInfo.baseUnit;
  if (unitInfo.kind === 'percent') {
    const normalized = normalizePercentSeries(values);
    values = normalized.series;
    unitDisplay = normalized.unit;
  }

  return {
    type: record['種別（アクティビティ・アウトプット・アウトカム）'],
    label: record['活動指標／成果指標'],
    unit,
    unit_disp: unitDisplay,
    unit_kind: unitInfo.kind,
    direction: record['改善の上向き／下向き'],
    series: rawSeries.map(({ year }, index) => ({ year, value: values[index] })),
  };
}

export function getProjectDetail(
  repository: ProjectCatalogRepository,
  projectId: string,
): ProjectDetail {
  const belongsToProject = (record: CatalogRecord) => projectIdOf(record) === projectId;
  const overview = latestRecord(repository.getProjectOverviews().filter(belongsToProject));
  const policies = repository.getPolicies().filter(belongsToProject).map(toProjectPolicy);
  const subsidies = repository.getSubsidies().filter(belongsToProject).map((record) => ({
    target: record['補助対象'],
    rate: record['補助率'],
    cap: record['補助上限等'],
    url: record['補助率URL'],
  }));
  const related = repository.getRelatedProjects().filter(belongsToProject).map((record) => ({
    related_id: record['関連事業の事業ID'],
    related_name: record['関連事業の事業名'],
    relation: record['関連性'],
  }));
  const kpis = repository.getKpiSeries()
    .filter(belongsToProject)
    .flatMap((record) => {
      const kpi = toProjectKpi(record);
      return kpi ? [kpi] : [];
    })
    .slice(0, 6);
  const links = repository.getKpiLinks().filter(belongsToProject).map((record) => ({
    from_no: record['派生元ーアクティビティ・アウトプット・アウトカムの番号'],
    from_type: record['派生元ー種別（アクティビティ・アウトプット・アウトカム）'],
    to_no: record['派生先ーアクティビティ・アウトプット・アウトカムの番号'],
    to_type: record['派生先ー種別（アクティビティ・アウトプット・アウトカム）'],
    reason: record['後続アウトカムへのつながり'],
  }));

  return { id: projectId, overview, policies, subsidies, related, kpis, links };
}

export function searchOutcomes(
  repository: ProjectCatalogRepository,
  input: { projectId?: string; query?: string; limit?: number },
): OutcomeItem[] {
  const query = input.query?.trim().toLowerCase() || '';
  const limit = input.limit ?? 200;
  return repository.getKpiSeries()
    .filter((record) => !input.projectId || projectIdOf(record) === input.projectId)
    .flatMap((record) => {
      const kpi = toProjectKpi(record);
      if (!kpi) return [];
      return [{
        project_id: projectIdOf(record),
        project_name: record['事業名'],
        ...kpi,
      }];
    })
    .filter((item) => !query
      || item.label.toLowerCase().includes(query)
      || item.project_name.toLowerCase().includes(query))
    .slice(0, limit);
}

export function searchPolicies(
  repository: ProjectCatalogRepository,
  queryRaw?: string,
): PolicyCatalogItem[] {
  const query = queryRaw?.trim().toLowerCase() || '';
  return repository.getPolicies()
    .map((record) => ({
      project_id: projectIdOf(record),
      project_name: record['事業名'],
      policy_no: record['番号（政策・施策）'],
      ministry: record['政策所管府省庁_P'],
      policy: record['政策'],
      program: record['施策'],
      url: record['政策・施策URL'],
      law_no: record['番号（根拠法令）'],
      law_name: record['法令名'],
      law_id: record['法令ID'],
      plan_name: record['計画通知名'],
    }))
    .filter((item) => !query
      || item.policy.toLowerCase().includes(query)
      || item.law_name.toLowerCase().includes(query)
      || item.project_name.toLowerCase().includes(query));
}
