"use client";

import { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { RawProjectData, SpendingItem } from '@/types';
import { isRawProjectData } from '@/types/guards';
import { GraphNodeDatum, GraphLinkDatum } from '@/features/graph/types';

export interface GraphDataResult {
  nodes: GraphNodeDatum[];
  links: GraphLinkDatum[];
  colorMap: Record<string, string>;
  loading: boolean;
  error: string | null;
  allAgencies?: string[];
  limitedNodes: GraphNodeDatum[];
}

const MAIN_HIERARCHY = ['bureau_agency', 'department', 'division', 'office', 'section', 'group', 'team'] as const;
const SUB_HIERARCHY = ['bureau_agency', 'department', 'division', 'office', 'section', 'group', 'team', 'project_name'] as const;

type HierarchyKey = typeof MAIN_HIERARCHY[number] | typeof SUB_HIERARCHY[number];

const DEFAULT_DIMENSIONS = { width: 1200, height: 800 };
const NODE_LIMIT = 500;

function buildColorMapFromTopLevels(topLevels: string[]): Record<string, string> {
  const n = topLevels.length || 1;
  const colorMap: Record<string, string> = {};
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const hue = 360 * t;
    colorMap[topLevels[i]] = d3.hcl(hue, 80, 65).toString();
  }
  return colorMap;
}

function getWindowDimensions() {
  if (typeof window !== 'undefined') {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return DEFAULT_DIMENSIONS;
}

function getItemValue(item: RawProjectData, key: HierarchyKey): string | undefined {
  return item[key as keyof RawProjectData] as string | undefined;
}

function getItemYomiValue(item: RawProjectData, key: string): string | undefined {
  return (item as Record<string, unknown>)[`${key}_yomi`] as string | undefined;
}

interface BuildGraphOptions {
  hierarchy: readonly HierarchyKey[];
  includeProjectDetails?: boolean;
  visibleAgencies?: string[];
  limitNodes?: number;
}

interface BuildGraphResult {
  nodes: GraphNodeDatum[];
  links: GraphLinkDatum[];
  colorMap: Record<string, string>;
  topLevels: Set<string>;
  limitedNodes: GraphNodeDatum[];
}

function buildGraphFromData(
  data: RawProjectData[],
  options: BuildGraphOptions
): BuildGraphResult {
  const { hierarchy, includeProjectDetails = false, visibleAgencies = [], limitNodes } = options;
  const { width, height } = getWindowDimensions();

  const nodes: GraphNodeDatum[] = [];
  const nodeMap = new Map<string, GraphNodeDatum>();
  const aggregatedBudgets = new Map<string, number>();
  const aggregatedLinkBudgets = new Map<string, Map<string, number>>();
  const topLevels = new Set<string>();

  data.forEach(item => {
    if (!isRawProjectData(item)) return;

    const topLevel = item.agency_name || item.ministry_name || '';
    const topLevelKey = item.agency_name ? 'agency_name' : 'ministry_name';
    if (!topLevel) return;

    topLevels.add(topLevel);
    if (visibleAgencies.length && !visibleAgencies.includes(topLevel)) return;

    const restHierarchy = hierarchy
      .map(k => getItemValue(item, k))
      .filter((v): v is string => v != null && v !== '');

    const restHierarchyYomi = hierarchy
      .map((k, i) => {
        const value = getItemValue(item, hierarchy[i]);
        if (value == null || value === '') return undefined;
        return getItemYomiValue(item, k);
      })
      .filter((v): v is string => v != null);

    const itemHierarchy = [topLevel, ...restHierarchy];
    const itemHierarchyYomi = [getItemYomiValue(item, topLevelKey), ...restHierarchyYomi].filter(Boolean) as string[];

    let parentNodeId: string | null = null;
    const nodePath: string[] = [];
    const currentBudget = Number(item.initial_budget_total) || 0;

    itemHierarchy.forEach((name, index) => {
      nodePath.push(String(name));
      const nodeId = nodePath.join('→');
      const isLast = index === itemHierarchy.length - 1;
      const baseGroup = index === 0 ? topLevelKey : hierarchy[index - 1] || 'unknown';
      const group = (includeProjectDetails && isLast) ? 'project_name' : baseGroup;

      if (!nodeMap.has(nodeId)) {
        const newNode: GraphNodeDatum = {
          id: nodeId,
          name: String(name),
          yomi: itemHierarchyYomi[index] || '',
          group,
          value: 0,
          initial_budget: includeProjectDetails ? (item.initial_budget_total || 0) : 0,
          url: '#',
          topLevel,
          ...(includeProjectDetails && isLast ? {
            project_id: String(item.project_id ?? ''),
            spending_list: (item.spending_list || []) as SpendingItem[],
          } : {}),
        };

        if (!includeProjectDetails) {
          newNode.x = width / 2 + (Math.random() - 0.5) * 50;
          newNode.y = height / 2 + (Math.random() - 0.5) * 50;
        }

        nodes.push(newNode);
        nodeMap.set(nodeId, newNode);
      }

      aggregatedBudgets.set(nodeId, (aggregatedBudgets.get(nodeId) || 0) + currentBudget);

      if (parentNodeId) {
        const sourceNode = nodeMap.get(parentNodeId);
        const targetNode = nodeMap.get(nodeId);
        if (sourceNode && targetNode) {
          if (!aggregatedLinkBudgets.has(sourceNode.id)) {
            aggregatedLinkBudgets.set(sourceNode.id, new Map());
          }
          const targetMap = aggregatedLinkBudgets.get(sourceNode.id)!;
          targetMap.set(targetNode.id, (targetMap.get(targetNode.id) || 0) + currentBudget);
        }
      }

      parentNodeId = nodeId;
    });
  });

  // Apply aggregated budgets to nodes
  nodes.forEach(node => {
    const budget = aggregatedBudgets.get(node.id) || 0;
    node.value = budget;
    node.initial_budget = budget;
  });

  // Build links from aggregated link budgets
  const links: GraphLinkDatum[] = [];
  aggregatedLinkBudgets.forEach((targetMap, sourceId) => {
    targetMap.forEach((budget, targetId) => {
      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);
      if (sourceNode && targetNode) {
        links.push({ source: sourceNode, target: targetNode, value: budget });
      }
    });
  });

  const colorMap = buildColorMapFromTopLevels(Array.from(topLevels));
  const limitedNodes = limitNodes ? nodes.slice(0, limitNodes) : nodes;

  return { nodes, links, colorMap, topLevels, limitedNodes };
}

function useFetchData<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[],
  errorMessage: string
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await fetchFn();
        if (!mounted) return;
        setData(result);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : errorMessage);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

export function useMainGraphData(visibleAgencies: string[]): GraphDataResult {
  const { data, loading, error } = useFetchData<RawProjectData[]>(
    async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [],
    'データ取得に失敗しました'
  );

  const allAgencies = useMemo(() => {
    if (!data) return [];
    const agencyNames = data.map(d => d.agency_name).filter(Boolean) as string[];
    const ministryNames = data.map(d => d.ministry_name).filter(Boolean) as string[];
    return Array.from(new Set([...agencyNames, ...ministryNames])).filter(Boolean);
  }, [data]);

  const { nodes, links, colorMap, limitedNodes } = useMemo(() => {
    if (!data?.length) {
      return { nodes: [], links: [], colorMap: {}, limitedNodes: [] };
    }

    return buildGraphFromData(data, {
      hierarchy: MAIN_HIERARCHY,
      includeProjectDetails: false,
      visibleAgencies,
      limitNodes: NODE_LIMIT,
    });
  }, [data, visibleAgencies]);

  return { nodes, links, colorMap, loading, error, allAgencies, limitedNodes };
}

export function useSubgraphData(nodeId: string | null): GraphDataResult {
  const { data, loading, error } = useFetchData<RawProjectData[]>(
    async () => {
      if (!nodeId) throw new Error('ノードID未指定');
      const res = await fetch(`/api/subgraph?node=${encodeURIComponent(nodeId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [nodeId],
    'サブグラフの取得に失敗しました'
  );

  const { nodes, links, colorMap, limitedNodes } = useMemo(() => {
    if (!data?.length) {
      return { nodes: [], links: [], colorMap: {}, limitedNodes: [] };
    }

    return buildGraphFromData(data, {
      hierarchy: SUB_HIERARCHY,
      includeProjectDetails: true,
    });
  }, [data]);

  return { nodes, links, colorMap, loading, error, limitedNodes };
}
