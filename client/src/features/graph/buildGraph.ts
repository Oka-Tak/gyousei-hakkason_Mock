import type { RawProjectData, SpendingItem } from '@/types';
import type { GraphLinkDatum, GraphNodeDatum } from '@/features/graph/types';

export const MAIN_HIERARCHY = [
  'bureau_agency',
  'department',
  'division',
  'office',
  'section',
  'group',
  'team',
] as const;

export const SUBGRAPH_HIERARCHY = [...MAIN_HIERARCHY, 'project_name'] as const;

type HierarchyKey = (typeof SUBGRAPH_HIERARCHY)[number];

export interface BuildGraphOptions {
  hierarchy: readonly HierarchyKey[];
  includeProjectDetails?: boolean;
  visibleAgencies?: readonly string[] | null;
  maxNodes?: number | null;
}

export interface BuiltGraph {
  nodes: GraphNodeDatum[];
  links: GraphLinkDatum[];
  colorMap: Record<string, string>;
}

function getText(item: RawProjectData, key: keyof RawProjectData): string | undefined {
  const value = item[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getYomi(item: RawProjectData, key: string): string {
  const value = item[`${key}_yomi` as keyof RawProjectData];
  return typeof value === 'string' ? value : '';
}

function buildColorMap(topLevels: readonly string[]): Record<string, string> {
  const count = Math.max(1, topLevels.length);
  return Object.fromEntries(
    topLevels.map((name, index) => [name, `hsl(${Math.round((360 * index) / count)} 68% 48%)`]),
  );
}

function getEndpointId(endpoint: GraphNodeDatum | string | number): string {
  return typeof endpoint === 'object' ? endpoint.id : String(endpoint);
}

/**
 * Keeps the most valuable branches while always retaining their ancestors.
 * This prevents a node cap from producing disconnected SVG nodes.
 */
export function limitGraph(
  nodes: readonly GraphNodeDatum[],
  links: readonly GraphLinkDatum[],
  maxNodes?: number | null,
): Pick<BuiltGraph, 'nodes' | 'links'> {
  if (maxNodes == null || nodes.length <= maxNodes) {
    return { nodes: [...nodes], links: [...links] };
  }
  if (maxNodes <= 0) return { nodes: [], links: [] };

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedIds = new Set<string>();

  const roots = nodes
    .filter((node) => node.parentId === null)
    .sort((a, b) => b.value - a.value)
    .slice(0, maxNodes);
  roots.forEach((node) => selectedIds.add(node.id));

  const candidates = nodes
    .filter((node) => node.parentId !== null)
    .sort((a, b) => b.value - a.value || a.depth - b.depth || a.id.localeCompare(b.id, 'ja'));

  for (const candidate of candidates) {
    if (selectedIds.has(candidate.id)) continue;

    const missingBranch: GraphNodeDatum[] = [];
    let current: GraphNodeDatum | undefined = candidate;
    while (current && !selectedIds.has(current.id)) {
      missingBranch.push(current);
      current = current.parentId ? nodeById.get(current.parentId) : undefined;
    }

    if (selectedIds.size + missingBranch.length > maxNodes) continue;
    for (let index = missingBranch.length - 1; index >= 0; index -= 1) {
      selectedIds.add(missingBranch[index].id);
    }
    if (selectedIds.size === maxNodes) break;
  }

  const limitedNodes = nodes.filter((node) => selectedIds.has(node.id));
  const limitedLinks = links.filter((link) => (
    selectedIds.has(getEndpointId(link.source)) && selectedIds.has(getEndpointId(link.target))
  ));
  return { nodes: limitedNodes, links: limitedLinks };
}

export function buildGraphFromData(
  data: readonly RawProjectData[],
  options: BuildGraphOptions,
): BuiltGraph {
  const {
    hierarchy,
    includeProjectDetails = false,
    visibleAgencies = null,
    maxNodes = null,
  } = options;
  const visibleAgencySet = visibleAgencies === null ? null : new Set(visibleAgencies);
  const topLevels = new Set<string>();
  const nodes: GraphNodeDatum[] = [];
  const nodeById = new Map<string, GraphNodeDatum>();

  for (const item of data) {
    const agencyName = getText(item, 'agency_name');
    const ministryName = getText(item, 'ministry_name');
    const topLevel = agencyName ?? ministryName;
    if (!topLevel) continue;

    topLevels.add(topLevel);
    if (visibleAgencySet && !visibleAgencySet.has(topLevel)) continue;

    const topLevelKey = agencyName ? 'agency_name' : 'ministry_name';
    const segments: Array<{ name: string; yomi: string; group: string; idSegment: string }> = [{
      name: topLevel,
      yomi: getYomi(item, topLevelKey),
      group: topLevelKey,
      idSegment: topLevel,
    }];

    for (const key of hierarchy) {
      const name = getText(item, key);
      if (!name) continue;
      const isProject = includeProjectDetails && key === 'project_name';
      const projectSuffix = isProject && item.project_id != null ? ` [#${item.project_id}]` : '';
      segments.push({
        name,
        yomi: getYomi(item, key),
        group: isProject ? 'project_name' : key,
        idSegment: `${name}${projectSuffix}`,
      });
    }

    const currentBudget = Number(item.initial_budget_total) || 0;
    const path: string[] = [];
    let parentId: string | null = null;

    segments.forEach((segment, depth) => {
      path.push(segment.idSegment);
      const id = path.join('→');
      let node = nodeById.get(id);

      if (!node) {
        const isProject = includeProjectDetails && segment.group === 'project_name';
        node = {
          id,
          name: segment.name,
          yomi: segment.yomi,
          group: segment.group,
          depth,
          parentId,
          value: 0,
          initial_budget: 0,
          url: '#',
          topLevel,
          ...(isProject ? {
            project_id: item.project_id == null ? '' : String(item.project_id),
            spending_list: (item.spending_list ?? []) as SpendingItem[],
          } : {}),
        };
        nodes.push(node);
        nodeById.set(id, node);
      }

      node.value += currentBudget;
      node.initial_budget = node.value;
      parentId = id;
    });
  }

  // The hierarchy is a tree, so every non-root node has exactly one incoming
  // edge whose aggregate value is the node's aggregate value.
  const links = nodes.flatMap<GraphLinkDatum>((node) => {
    if (!node.parentId) return [];
    const parent = nodeById.get(node.parentId);
    return parent ? [{ source: parent, target: node, value: node.value }] : [];
  });

  const limited = limitGraph(nodes, links, maxNodes);
  return {
    ...limited,
    colorMap: buildColorMap([...topLevels]),
  };
}
