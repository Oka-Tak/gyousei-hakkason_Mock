type ProjectOverview = Readonly<Record<string, string>>;

export interface ProjectPolicy {
  policy_no: string;
  policy_ministry: string;
  policy: string;
  program: string;
  url: string;
  law_no: string;
  law_name: string;
  law_id: string;
  law_article: string;
  law_item: string;
  law_clause: string;
  plan_no: string;
  plan_name: string;
  plan_url: string;
}

interface ProjectSubsidy {
  target: string;
  rate: string;
  cap: string;
  url: string;
}

interface RelatedProject {
  related_id: string;
  related_name: string;
  relation: string;
}

export interface ProjectKpi {
  type: string;
  label: string;
  unit: string;
  unit_disp: string;
  unit_kind: 'yen' | 'percent' | 'count' | 'other';
  direction: string;
  series: Array<{ year: number; value: number }>;
}

interface ProjectKpiLink {
  from_no: string;
  from_type: string;
  to_no: string;
  to_type: string;
  reason: string;
}

export interface ProjectDetail {
  id: string;
  overview: ProjectOverview | null;
  policies: ProjectPolicy[];
  subsidies: ProjectSubsidy[];
  related: RelatedProject[];
  kpis: ProjectKpi[];
  links: ProjectKpiLink[];
}

export interface OutcomeItem extends ProjectKpi {
  project_id: string;
  project_name: string;
}

export interface PolicyCatalogItem {
  project_id: string;
  project_name: string;
  policy_no: string;
  ministry: string;
  policy: string;
  program: string;
  url: string;
  law_no: string;
  law_name: string;
  law_id: string;
  plan_name: string;
}
