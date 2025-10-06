"use client";

import React, { useEffect, useMemo, useState } from "react";
import ForceGraph from "@/components/graph/ForceGraph";
import { NODE_SIZE_BY_GROUP } from "@/features/graph/constants";
import { useMainGraphData } from "@/features/graph/hooks/useGraphData";
import type { GraphNodeDatum, GraphLinkDatum } from "@/features/graph/types";
import Money from "@/components/common/Money";

type TileSize = 'small' | 'medium' | 'large';
const TILE_SIZES: Record<TileSize, { w: number; h: number }> = {
  small: { w: 300, h: 240 },
  medium: { w: 360, h: 280 },
  large: { w: 420, h: 320 },
};

const AgenciesPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch all data once; filtering happens client-side per ministry/agency
  const [visibleAgencies, setVisibleAgencies] = useState<string[]>([]);
  const { nodes, links, colorMap, loading, error, allAgencies } = useMainGraphData(visibleAgencies);

  // default to all agencies when loaded
  useEffect(() => {
    if (allAgencies && allAgencies.length && visibleAgencies.length === 0) {
      setVisibleAgencies(allAgencies);
    }
  }, [allAgencies, visibleAgencies.length]);

  // Controls
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<'name' | 'value_desc' | 'nodes_desc'>('name');
  const [tileSize, setTileSize] = useState<TileSize>('medium');

  const agenciesToShow = useMemo(() => {
    const base = (visibleAgencies.length ? visibleAgencies : allAgencies) || [];
    const filtered = query ? base.filter(a => a.toLowerCase().includes(query.toLowerCase())) : base;
    // temp graphs info for sorting
    const temp = filtered.map(top => {
      const n = nodes.filter(x => x.topLevel === top);
      const topNode = n.find(x => x.group === 'agency_name' || x.group === 'ministry_name');
      const value = topNode?.value || 0;
      return { top, count: n.length, value };
    });
    temp.sort((a, b) => {
      if (sortKey === 'name') return a.top.localeCompare(b.top, 'ja');
      if (sortKey === 'value_desc') return (b.value || 0) - (a.value || 0);
      return (b.count || 0) - (a.count || 0);
    });
    return temp.map(t => t.top);
  }, [visibleAgencies, allAgencies, nodes, query, sortKey]);

  const graphs = useMemo(() => {
    if (!nodes.length) return [] as {
      topLevel: string;
      nodes: GraphNodeDatum[];
      links: GraphLinkDatum[];
      colorMap: Record<string, string>;
    }[];
    return agenciesToShow.map((top) => {
      const n = nodes.filter((x) => x.topLevel === top);
      const idSet = new Set(n.map((x) => x.id));
      const l = links.filter(
        (e) => idSet.has(e.source.id) && idSet.has(e.target.id)
      );
      const cmap: Record<string, string> = { [top]: colorMap[top] };
      return { topLevel: top, nodes: n, links: l, colorMap: cmap };
    });
  }, [nodes, links, colorMap, agenciesToShow]);

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
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}>
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
        {graphs.map(({ topLevel, nodes, links, colorMap }) => {
          const topNode = nodes.find((n) => n.group === 'agency_name' || n.group === 'ministry_name');
          const total = topNode?.value || 0;
          const firstLevelCount = nodes.filter(n => (n.id.split('→').length === 2)).length;
          const depth = nodes.reduce((m, n) => Math.max(m, n.id.split('→').length - 1), 0);
          const Amount = ({ v }: { v: number }) => <Money amount={v} />;
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
                  <div style={{ fontWeight: 700, fontSize: 13 }}><Amount v={total} /></div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>ノード数</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{nodes.length}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>第一階層</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{firstLevelCount}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>リンク数</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{links.length}</div>
                </div>
              </div>

              <ForceGraph
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
