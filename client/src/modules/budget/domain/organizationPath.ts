const NODE_PATH_SEPARATOR = '→';

export interface OrganizationHierarchy {
  bureau: string | null | undefined;
  department: string | null | undefined;
  division: string | null | undefined;
  office: string | null | undefined;
  section: string | null | undefined;
  group: string | null | undefined;
  team: string | null | undefined;
}

export type OrganizationPath = readonly string[];

export interface OrganizationNodeReference {
  topLevel: string;
  path: OrganizationPath;
}

export function createOrganizationPath(hierarchy: OrganizationHierarchy): OrganizationPath {
  return [
    hierarchy.bureau,
    hierarchy.department,
    hierarchy.division,
    hierarchy.office,
    hierarchy.section,
    hierarchy.group,
    hierarchy.team,
  ].filter((value): value is string => Boolean(value));
}

export function parseOrganizationNodeId(nodeId: string): OrganizationNodeReference | null {
  const [topLevel, ...path] = nodeId.split(NODE_PATH_SEPARATOR).filter(Boolean);
  return topLevel ? { topLevel, path } : null;
}

export function matchesOrganizationPath(
  hierarchy: OrganizationHierarchy,
  expectedPath: OrganizationPath,
): boolean {
  const candidate = createOrganizationPath(hierarchy);
  return expectedPath.every((segment, index) => candidate[index] === segment);
}
