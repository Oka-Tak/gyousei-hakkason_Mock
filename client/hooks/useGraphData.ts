"use client";

import { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { RawProjectData } from '../src/types';
import { isRawProjectData } from '../src/types/guards';

export type GraphNodeDatum = d3.SimulationNodeDatum & {
  id: string;
  name: string;
  yomi?: string;
  group: string;
  value: number;
  url?: string;
  initial_budget?: number;
  topLevel: string;
  spending_list?: any[];
  project_id?: string;
};

export type GraphLinkDatum = d3.SimulationLinkDatum<GraphNodeDatum> & {
  value: number;
  source: GraphNodeDatum;
  target: GraphNodeDatum;
};

export interface GraphDataResult {
  nodes: GraphNodeDatum[];
  links: GraphLinkDatum[];
  colorMap: Record<string, string>;
  loading: boolean;
  error: string | null;
  allAgencies?: string[];
  limitedNodes: GraphNodeDatum[]; // for search list
}

const MAIN_HIERARCHY = [
  'bureau_agency',
  'department',
  'division',
  'office',
  'section',
  'group',
  'team',
  // no project_name for main graph
] as const;

const SUB_HIERARCHY = [
  'bureau_agency',
  'department',
  'division',
  'office',
  'section',
  'group',
  'team',
  'project_name',
] as const;

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

export function useMainGraphData(visibleAgencies: string[]): GraphDataResult {
  const [data, setData] = useState<RawProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: RawProjectData[] = await res.json();
        if (!mounted) return;
        setData(json);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const allAgencies = useMemo(() => {
    const agencyNames = data.map(d => d.agency_name).filter(Boolean) as string[];
    const ministryNames = data.map(d => d.ministry_name).filter(Boolean) as string[];
    return Array.from(new Set([...agencyNames, ...ministryNames])).filter(Boolean);
  }, [data]);

  const { nodes, links, colorMap, limitedNodes } = useMemo(() => {
    if (!data.length) return { nodes: [] as GraphNodeDatum[], links: [] as GraphLinkDatum[], colorMap: {}, limitedNodes: [] as GraphNodeDatum[] };

    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;

    const nodes: GraphNodeDatum[] = [];
    const nodeMap = new Map<string, GraphNodeDatum>();
    const aggregatedBudgets = new Map<string, number>();
    const aggregatedLinkBudgets = new Map<string, Map<string, number>>();

    const topLevels = new Set<string>();

    data.forEach(item => {
      if (!isRawProjectData(item)) return;
      let topLevel = item.agency_name || item.ministry_name || '';
      const topLevelKey = item.agency_name ? 'agency_name' : 'ministry_name';
      if (!topLevel) return;
      topLevels.add(topLevel);
      // filter by visible agencies
      if (visibleAgencies.length && !visibleAgencies.includes(topLevel)) return;

      const restHierarchy = MAIN_HIERARCHY.map(k => item[k as keyof RawProjectData]).filter(Boolean) as string[];
      const restHierarchyYomi = MAIN_HIERARCHY.map(k => item[(k + '_yomi') as keyof RawProjectData]).filter(Boolean) as string[];
      const hierarchy = [topLevel, ...restHierarchy];
      const hierarchyYomi = [(item as any)[`${topLevelKey}_yomi`], ...restHierarchyYomi].filter(Boolean) as string[];

      let parentNodeId: string | null = null;
      const nodePath: string[] = [];
      const nodePathYomi: string[] = [];
      const currentBudget = Number(item.initial_budget_total) || 0;

      hierarchy.forEach((name, idx) => {
        nodePath.push(String(name));
        nodePathYomi.push(String(hierarchyYomi[idx] || ''));
        const nodeId = nodePath.join('→');
        const nodeYomi = nodePathYomi.join('→');
        const groupName = idx === 0 ? topLevelKey : MAIN_HIERARCHY[idx - 1] || 'unknown';

        if (!nodeMap.has(nodeId)) {
          const newNode: GraphNodeDatum = {
            id: nodeId,
            name: String(name),
            yomi: nodeYomi,
            group: groupName,
            value: 0,
            initial_budget: 0,
            url: '#',
            topLevel,
          };
          // initial radial-ish placement per top-level segment for stability (optional)
          // center-ish start positions
          newNode.x = width / 2 + (Math.random() - 0.5) * 50;
          newNode.y = height / 2 + (Math.random() - 0.5) * 50;
          nodes.push(newNode);
          nodeMap.set(nodeId, newNode);
        }

        aggregatedBudgets.set(nodeId, (aggregatedBudgets.get(nodeId) || 0) + currentBudget);

        if (parentNodeId) {
          const sourceNode = nodeMap.get(parentNodeId);
          const targetNode = nodeMap.get(nodeId);
          if (sourceNode && targetNode) {
            if (!aggregatedLinkBudgets.has(sourceNode.id)) aggregatedLinkBudgets.set(sourceNode.id, new Map());
            const targetMap = aggregatedLinkBudgets.get(sourceNode.id)!;
            targetMap.set(targetNode.id, (targetMap.get(targetNode.id) || 0) + currentBudget);
          }
        }
        parentNodeId = nodeId;
      });
    });

    nodes.forEach(n => {
      const v = aggregatedBudgets.get(n.id) || 0;
      n.value = v;
      n.initial_budget = v;
    });

    const links: GraphLinkDatum[] = [];
    aggregatedLinkBudgets.forEach((targetMap, sourceId) => {
      targetMap.forEach((budget, targetId) => {
        const s = nodeMap.get(sourceId);
        const t = nodeMap.get(targetId);
        if (s && t) links.push({ source: s, target: t, value: budget });
      });
    });

    const limitedNodes = nodes.slice(0, 500);
    const colorMap = buildColorMapFromTopLevels(Array.from(topLevels));

    return { nodes, links, colorMap, limitedNodes };
  }, [data, visibleAgencies]);

  return { nodes, links, colorMap, loading, error, allAgencies, limitedNodes };
}

export function useSubgraphData(nodeId: string | null): GraphDataResult {
  const [data, setData] = useState<RawProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!nodeId) throw new Error('ノードID未指定');
        const res = await fetch(`/api/subgraph?node=${encodeURIComponent(nodeId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: RawProjectData[] = await res.json();
        if (!mounted) return;
        setData(json);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'サブグラフの取得に失敗しました');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [nodeId]);

  const { nodes, links, colorMap, limitedNodes } = useMemo(() => {
    if (!data.length) return { nodes: [] as GraphNodeDatum[], links: [] as GraphLinkDatum[], colorMap: {}, limitedNodes: [] as GraphNodeDatum[] };
    const nodes: GraphNodeDatum[] = [];
    const nodeMap = new Map<string, GraphNodeDatum>();
    const aggregatedBudgets = new Map<string, number>();
    const aggregatedLinkBudgets = new Map<string, Map<string, number>>();
    const topLevels = new Set<string>();

    const filtered = data; // APIで既に絞られている前提

    filtered.forEach(item => {
      let topLevel = item.agency_name || item.ministry_name || '';
      const topLevelKey = item.agency_name ? 'agency_name' : 'ministry_name';
      if (!topLevel) return;
      topLevels.add(topLevel);

      const rest = SUB_HIERARCHY.map(k => item[k]).filter(v => v != null && v !== '') as string[];
      const restYomi = SUB_HIERARCHY.map(k => item[(k + '_yomi') as keyof RawProjectData]).filter((v, i) => (item as any)[SUB_HIERARCHY[i]] != null && (item as any)[SUB_HIERARCHY[i]] !== '') as string[];
      const hierarchy = [topLevel, ...rest];
      const hierarchyYomi = [(item as any)[`${topLevelKey}_yomi`], ...restYomi];
      let parentNodeId: string | null = null;
      const nodePath: string[] = [];
      const nodePathYomi: string[] = [];
      const currentBudget = Number(item.initial_budget_total) || 0;
      const url = item.review_sheet_url || '#';

      hierarchy.forEach((name, index) => {
        nodePath.push(String(name));
        nodePathYomi.push(String(hierarchyYomi[index] || ''));
        const id = nodePath.join('→');
        const nodeYomi = nodePathYomi.join('→');
        const isLast = index === hierarchy.length - 1;
        const baseGroup = index === 0 ? topLevelKey : SUB_HIERARCHY[index - 1] || 'unknown';
        const group = isLast ? 'project_name' : baseGroup;

        if (!nodeMap.has(id)) {
          const newNode: GraphNodeDatum = {
            id,
            name: String(name),
            yomi: nodeYomi,
            group,
            value: 0,
            initial_budget: item.initial_budget_total || 0,
            url,
            topLevel,
            project_id: isLast ? String(item.project_id ?? '') : undefined,
            spending_list: item.spending_list || [],
          };
          nodes.push(newNode);
          nodeMap.set(id, newNode);
        }

        aggregatedBudgets.set(id, (aggregatedBudgets.get(id) || 0) + currentBudget);
        if (parentNodeId) {
          const s = nodeMap.get(parentNodeId);
          const t = nodeMap.get(id);
          if (s && t) {
            if (!aggregatedLinkBudgets.has(s.id)) aggregatedLinkBudgets.set(s.id, new Map());
            const targetMap = aggregatedLinkBudgets.get(s.id)!;
            targetMap.set(t.id, (targetMap.get(t.id) || 0) + currentBudget);
          }
        }
        parentNodeId = id;
      });
    });

    nodes.forEach(n => {
      const v = aggregatedBudgets.get(n.id) || 0;
      n.value = v;
      n.initial_budget = v;
    });

    const links: GraphLinkDatum[] = [];
    aggregatedLinkBudgets.forEach((targetMap, sourceId) => {
      targetMap.forEach((budget, targetId) => {
        const s = nodeMap.get(sourceId);
        const t = nodeMap.get(targetId);
        if (s && t) links.push({ source: s, target: t, value: budget });
      });
    });

    const colorMap = buildColorMapFromTopLevels(Array.from(topLevels));
    const limitedNodes = nodes; // subgraph shows all
    return { nodes, links, colorMap, limitedNodes };
  }, [data]);

  return { nodes, links, colorMap, loading, error, limitedNodes };
}

