export type CatalogRecord = Readonly<Record<string, string>>;

export interface ProjectCatalogRepository {
  getProjectOverviews(): readonly CatalogRecord[];
  getPolicies(): readonly CatalogRecord[];
  getSubsidies(): readonly CatalogRecord[];
  getRelatedProjects(): readonly CatalogRecord[];
  getKpiSeries(): readonly CatalogRecord[];
  getKpiLinks(): readonly CatalogRecord[];
}
