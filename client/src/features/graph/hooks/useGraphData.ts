"use client";

import { useMemo } from 'react';
import type { RawProjectData } from '@/types';
import type { GraphLinkDatum, GraphNodeDatum } from '@/features/graph/types';
import {
  buildGraphFromData,
  MAIN_HIERARCHY,
  SUBGRAPH_HIERARCHY,
} from '@/features/graph/buildGraph';
import { useApiData } from '@/hooks/useApiData';

export interface GraphDataResult {
  nodes: GraphNodeDatum[];
  links: GraphLinkDatum[];
  colorMap: Record<string, string>;
  loading: boolean;
  error: string | null;
  allAgencies?: string[];
}

export interface MainGraphOptions {
  maxNodes?: number | null;
}

const MAIN_GRAPH_NODE_LIMIT = 500;
const SUBGRAPH_NODE_LIMIT = 700;
const MAIN_DATA_ERROR = 'データ取得に失敗しました';
const SUBGRAPH_DATA_ERROR = 'サブグラフの取得に失敗しました';

export function useMainGraphData(
  visibleAgencies: readonly string[] | null = null,
  options: MainGraphOptions = {},
): GraphDataResult {
  const { data, loading, error } = useApiData<RawProjectData[]>('/api/data', MAIN_DATA_ERROR);
  const maxNodes = options.maxNodes === undefined ? MAIN_GRAPH_NODE_LIMIT : options.maxNodes;

  const allAgencies = useMemo(() => {
    if (!data) return [];
    const names = data.flatMap((item) => {
      const name = item.agency_name || item.ministry_name;
      return name ? [name] : [];
    });
    return [...new Set(names)];
  }, [data]);

  const graph = useMemo(() => {
    if (!data?.length) return { nodes: [], links: [], colorMap: {} };
    return buildGraphFromData(data, {
      hierarchy: MAIN_HIERARCHY,
      visibleAgencies,
      maxNodes,
    });
  }, [data, maxNodes, visibleAgencies]);

  return { ...graph, loading, error, allAgencies };
}

export function useSubgraphData(nodeId: string | null): GraphDataResult {
  const url = nodeId ? `/api/subgraph?node=${encodeURIComponent(nodeId)}` : null;
  const { data, loading, error } = useApiData<RawProjectData[]>(url, SUBGRAPH_DATA_ERROR);

  const graph = useMemo(() => {
    if (!data?.length) return { nodes: [], links: [], colorMap: {} };
    return buildGraphFromData(data, {
      hierarchy: SUBGRAPH_HIERARCHY,
      includeProjectDetails: true,
      maxNodes: SUBGRAPH_NODE_LIMIT,
    });
  }, [data]);

  return { ...graph, loading, error };
}
