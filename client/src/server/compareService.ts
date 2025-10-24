import { fetchMainData } from './dataService';
import { fetchTopRecipientsByAgency, fetchTopRecipientsByProject } from './insightService';

export type CompareTargetAgency = {
  type: 'agency';
  value: string;
  label: string;
};

export type CompareTargetProject = {
  type: 'project';
  projectId: number;
  label: string;
};

export type CompareTarget = CompareTargetAgency | CompareTargetProject;

export type CompareSummary = {
  target: CompareTarget;
  total: number;
  projectCount: number;
  firstLevel: Array<{ name: string; value: number }>;
};

export async function fetchCompareSummary(input: { type: 'agency'; value: string } | { type: 'project'; projectId: number }): Promise<CompareSummary | null> {
  const rows = await fetchMainData();
  if (!rows.length) return null;

  if (input.type === 'agency') {
    const { value } = input;
    const filtered = rows.filter((r: any) => r.agency_name === value || r.ministry_name === value);
    if (!filtered.length) return null;

    const total = filtered.reduce((sum: number, row: any) => sum + Number(row.total_budget || 0), 0);
    const projectIds = new Set<number>();
    filtered.forEach((r: any) => {
      if (typeof r.project_id === 'number') projectIds.add(r.project_id);
    });
    const projectCount = projectIds.size || filtered.length;
    const firstLevelMap = new Map<string, number>();
    filtered.forEach((row: any) => {
      const key = row.bureau_agency || 'その他';
      firstLevelMap.set(key, (firstLevelMap.get(key) || 0) + Number(row.total_budget || 0));
    });
    const firstLevel = Array.from(firstLevelMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      target: { type: 'agency', value, label: value },
      total,
      projectCount,
      firstLevel,
    };
  }

  const { projectId } = input;
  const filtered = rows.filter((r: any) => Number(r.project_id) === Number(projectId));
  if (!filtered.length) return null;

  const projectRow = filtered[0];
  const label = (projectRow.project_name as string | null) || `プロジェクトID ${projectId}`;
  const total = filtered.reduce((sum: number, row: any) => sum + Number(row.total_budget || 0), 0);
  const firstLevelMap = new Map<string, number>();
  filtered.forEach((row: any) => {
    const key = row.bureau_agency || row.agency_name || 'その他';
    firstLevelMap.set(key, (firstLevelMap.get(key) || 0) + Number(row.total_budget || 0));
  });
  const firstLevel = Array.from(firstLevelMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    target: { type: 'project', projectId: Number(projectId), label },
    total,
    projectCount: 1,
    firstLevel,
  };
}

export async function fetchCompareRecipients(input: { type: 'agency'; value: string; limit?: number } | { type: 'project'; projectId: number; limit?: number }) {
  if (input.type === 'agency') {
    return fetchTopRecipientsByAgency(input.value, input.limit);
  }
  return fetchTopRecipientsByProject(input.projectId, input.limit);
}

