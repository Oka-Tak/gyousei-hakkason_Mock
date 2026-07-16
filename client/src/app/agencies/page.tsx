"use client";

import React, { useMemo, useState } from "react";
import LazyForceGraph from "@/components/graph/LazyForceGraph";
import { NODE_SIZE_BY_GROUP } from "@/features/graph/constants";
import { useMainGraphData } from "@/features/graph/hooks/useGraphData";
import type { GraphNodeDatum, GraphLinkDatum } from "@/features/graph/types";
import Money from "@/components/common/Money";
import { limitGraph } from "@/features/graph/buildGraph";
import { useIsMobile } from "@/hooks/useIsMobile";

type TileSize = 'small' | 'medium' | 'large';
type SortKey = 'name' | 'value_desc' | 'nodes_desc';
const TILE_SIZES: Record<TileSize, { w: number; h: number }> = {
  small: { w: 300, h: 240 },
  medium: { w: 360, h: 280 },
  large: { w: 420, h: 320 },
};

const AgenciesPage: React.FC = () => {
  const isMobile = useIsMobile();

  // Fetch all data once; filtering happens client-side per ministry/agency
  const { nodes, links, colorMap, loading, error, allAgencies } = useMainGraphData(null, { maxNodes: null });

  // Controls
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [tileSize, setTileSize] = useState<TileSize>('medium');

  const graphsByTopLevel = useMemo(() => {
    const grouped = new Map<string, { nodes: GraphNodeDatum[]; links: GraphLinkDatum[] }>();
    nodes.forEach((node) => {
      const graph = grouped.get(node.topLevel) ?? { nodes: [], links: [] };
      graph.nodes.push(node);
      grouped.set(node.topLevel, graph);
    });
    links.forEach((link) => {
      const topLevel = (link.source as GraphNodeDatum).topLevel;
      grouped.get(topLevel)?.links.push(link);
    });
    return grouped;
  }, [links, nodes]);

  const agenciesToShow = useMemo(() => {
    const base = allAgencies || [];
    const filtered = query ? base.filter(a => a.toLowerCase().includes(query.toLowerCase())) : base;
    const temp = filtered.map(top => {
      const graph = graphsByTopLevel.get(top);
      const topNode = graph?.nodes.find((node) => node.depth === 0);
      const value = topNode?.value || 0;
      return { top, count: graph?.nodes.length ?? 0, value };
    });
    temp.sort((a, b) => {
      if (sortKey === 'name') return a.top.localeCompare(b.top, 'ja');
      if (sortKey === 'value_desc') return (b.value || 0) - (a.value || 0);
      return (b.count || 0) - (a.count || 0);
    });
    return temp.map(t => t.top);
  }, [allAgencies, graphsByTopLevel, query, sortKey]);

  const graphs = useMemo(() => {
    if (!nodes.length) return [] as Array<{
      topLevel: string;
      nodes: GraphNodeDatum[];
      links: GraphLinkDatum[];
      colorMap: Record<string, string>;
      allNodeCount: number;
      allLinkCount: number;
    }>;

    const previewLimit = tileSize === 'small' ? 70 : tileSize === 'medium' ? 90 : 110;
    return agenciesToShow.flatMap((topLevel) => {
      const graph = graphsByTopLevel.get(topLevel);
      if (!graph) return [];
      const preview = limitGraph(graph.nodes, graph.links, previewLimit);
      return [{
        topLevel,
        ...preview,
        colorMap: { [topLevel]: colorMap[topLevel] },
        allNodeCount: graph.nodes.length,
        allLinkCount: graph.links.length,
      }];
    });
  }, [agenciesToShow, colorMap, graphsByTopLevel, nodes.length, tileSize]);

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>エラー: {error}</div>;

  const size = TILE_SIZES[tileSize];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>省庁一覧（分離表示）</h2>
        <input
          placeholder="省庁名で絞り込み"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, minWidth: 200 }}
        />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          並び替え
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}>
            <option value="name">名前順</option>
            <option value="value_desc">総額の大きい順</option>
            <option value="nodes_desc">ノード数の多い順</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          タイル
          <select value={tileSize} onChange={(e) => setTileSize(e.target.value as TileSize)} style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}>
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
          </select>
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${size.w}px, 1fr))`,
          gap: 16,
        }}
      >
        {graphs.map(({ topLevel, nodes, links, colorMap, allNodeCount, allLinkCount }) => {
          const fullGraph = graphsByTopLevel.get(topLevel);
          const topNode = fullGraph?.nodes.find((node) => node.depth === 0);
          const total = topNode?.value || 0;
          const firstLevelCount = fullGraph?.nodes.filter((node) => node.depth === 1).length ?? 0;
          return (
            <div key={topLevel} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#fff", boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 8px 6px 8px" }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: colorMap[topLevel] }} />
                  {topLevel}
                </div>
                <button
                  onClick={() => {
                    const id = topNode?.id || topLevel;
                    window.location.href = `/subgraph?node=${encodeURIComponent(id)}`;
                  }}
                  style={{ fontSize: 12, background: "#07796b", color: '#fff', border: "1px solid #07796b", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                >
                  サブグラフへ
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '4px 8px 8px 8px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>総額</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}><Money amount={total} /></div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>ノード数</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{allNodeCount}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>第一階層</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{firstLevelCount}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>リンク数</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{allLinkCount}</div>
                </div>
              </div>

              <LazyForceGraph
                nodes={nodes}
                links={links}
                colorMap={colorMap}
                nodeSizeByGroup={NODE_SIZE_BY_GROUP}
                width={size.w - 16}
                height={size.h}
                isMobile={isMobile}
                showTopLevelLabels
                onNodeClick={(d) => {
                  window.location.href = `/subgraph?node=${encodeURIComponent(d.id)}`;
                }}
                svgStyle={{ display: "block", margin: "0 auto" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgenciesPage;
