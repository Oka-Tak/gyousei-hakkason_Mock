"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import ForceGraph from "@/components/graph/ForceGraph";
import { NODE_SIZE_BY_GROUP } from "@/features/graph/constants";
import { useMainGraphData } from "@/features/graph/hooks/useGraphData";
import type { GraphNodeDatum, GraphLinkDatum } from "@/features/graph/types";
import { useIsMobile } from "@/hooks/useIsMobile";

const ExplorePage: React.FC = () => {
  const isMobile = useIsMobile();

  // Agencies selection
  const [selectedAgencies, setSelectedAgencies] = useState<string[] | null>(null);
  const { nodes, links, colorMap, loading, error, allAgencies } = useMainGraphData(selectedAgencies);
  const activeAgencies = selectedAgencies ?? allAgencies ?? [];

  // Controls: depth and budget threshold
  const [maxDepth, setMaxDepth] = useState(3);
  const valueExtent = useMemo(() => {
    const vals = nodes.map((n) => Number(n.value || 0)).filter((v) => !Number.isNaN(v));
    const max = vals.length ? Math.max(...vals) : 0;
    return { min: 0, max };
  }, [nodes]);
  const [minBudget, setMinBudget] = useState(0);

  // Path finder state
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [startId, setStartId] = useState<string | null>(null);
  const [endId, setEndId] = useState<string | null>(null);
  const [highlightNodeIds, setHighlightNodeIds] = useState<string[]>([]);
  const [highlightEdges, setHighlightEdges] = useState<{ sourceId: string; targetId: string }[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimer = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const id = window.setInterval(() => {
        setMaxDepth((d) => (d >= 6 ? 1 : d + 1));
      }, 1800);
      playTimer.current = id;
      return () => {
        if (playTimer.current) window.clearInterval(playTimer.current);
        playTimer.current = null;
      };
    } else {
      if (playTimer.current) window.clearInterval(playTimer.current);
      playTimer.current = null;
    }
  }, [isPlaying]);

  // Build Fuse for node search (on filtered nodes later)
  // We will rebuild after filtering

  // Filter nodes/links by depth and budget
  const { filteredNodes, filteredLinks } = useMemo(() => {
    if (!nodes.length) return { filteredNodes: [] as GraphNodeDatum[], filteredLinks: [] as GraphLinkDatum[] };
    const kept = nodes.filter((n) => {
      const depth = n.depth;
      const keepByDepth = depth <= maxDepth;
      const keepByBudget = (n.value || 0) >= minBudget || depth === 0; // always keep top level
      return keepByDepth && keepByBudget;
    });
    const idSet = new Set(kept.map((n) => n.id));
    const keptLinks = links.filter((l) => idSet.has(l.source.id) && idSet.has(l.target.id));
    return { filteredNodes: kept, filteredLinks: keptLinks };
  }, [nodes, links, maxDepth, minBudget]);

  // Rebuild Fuse on filteredNodes
  const fuse = useMemo(() => new Fuse(filteredNodes, { keys: ["name", "yomi"], threshold: 0.3, ignoreLocation: true }), [filteredNodes]);
  const startSugg = useMemo(() => (startText ? fuse.search(startText).slice(0, 8).map(r => r.item) : []), [fuse, startText]);
  const endSugg = useMemo(() => (endText ? fuse.search(endText).slice(0, 8).map(r => r.item) : []), [fuse, endText]);

  // Compute BFS path on demand
  const computePath = (overrideEndId?: string) => {
    const destinationId = overrideEndId ?? endId;
    if (!startId || !destinationId) return;
    const adj = new Map<string, string[]>();
    filteredLinks.forEach((l) => {
      const s = l.source.id, t = l.target.id;
      if (!adj.has(s)) adj.set(s, []);
      if (!adj.has(t)) adj.set(t, []);
      adj.get(s)!.push(t);
      adj.get(t)!.push(s);
    });
    const q: string[] = [startId];
    const prev = new Map<string, string | null>();
    prev.set(startId, null);
    let queueIndex = 0;
    while (queueIndex < q.length) {
      const u = q[queueIndex];
      queueIndex += 1;
      if (u === destinationId) break;
      const nbrs = adj.get(u) || [];
      for (const v of nbrs) {
        if (!prev.has(v)) { prev.set(v, u); q.push(v); }
      }
    }
    if (!prev.has(destinationId)) {
      setHighlightNodeIds([]);
      setHighlightEdges([]);
      return;
    }
    const path: string[] = [];
    let cur: string | null = destinationId;
    while (cur) { path.push(cur); cur = prev.get(cur) ?? null; }
    path.reverse();
    const edges = [] as { sourceId: string; targetId: string }[];
    for (let i = 0; i + 1 < path.length; i++) edges.push({ sourceId: path[i], targetId: path[i + 1] });
    setHighlightNodeIds(path);
    setHighlightEdges(edges);
  };

  // Clear highlights when filters change significantly
  useEffect(() => {
    setHighlightNodeIds([]);
    setHighlightEdges([]);
  }, [maxDepth, minBudget, selectedAgencies]);

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>エラー: {error}</div>;

  const formatJPY = (v: number) => `¥${Math.round(v).toLocaleString('ja-JP')}`;
  const topLevels = Array.from(new Set(filteredNodes.map(n => n.topLevel)));

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>インタラクティブ探索</h2>
        <button
          onClick={() => setIsPlaying(p => !p)}
          style={{ border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', background: isPlaying ? '#ef4444' : '#f8fafc', color: isPlaying ? '#fff' : '#111', cursor: 'pointer' }}
        >{isPlaying ? '停止' : '自動深度再生'}</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>深さ</label>
          <input type="range" min={1} max={6} step={1} value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} />
          <span>{maxDepth}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>最小予算</label>
          <input type="range" min={0} max={valueExtent.max || 1} step={Math.max(1, Math.round((valueExtent.max || 1) / 100))} value={minBudget} onChange={(e) => setMinBudget(Number(e.target.value))} style={{ width: 200 }} />
          <span>{formatJPY(minBudget)}</span>
        </div>
        <details>
          <summary style={{ cursor: 'pointer' }}>省庁選択（{activeAgencies.length}）</summary>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 8, borderRadius: 8, maxHeight: 280, overflow: 'auto', minWidth: 220 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <button onClick={() => setSelectedAgencies(allAgencies || [])} style={{ fontSize: 12, border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px', background: '#f8fafc', cursor: 'pointer' }}>全選択</button>
              <button onClick={() => setSelectedAgencies([])} style={{ fontSize: 12, border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px', background: '#f8fafc', cursor: 'pointer' }}>全解除</button>
            </div>
            {(allAgencies || []).map((a) => (
              <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                <input type="checkbox" checked={activeAgencies.includes(a)} onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectedAgencies((current) => {
                    const base = current ?? allAgencies ?? [];
                    return checked ? Array.from(new Set([...base, a])) : base.filter((item) => item !== a);
                  });
                }} />
                <span>{a}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '1 1 320px', minWidth: 300, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>パス探索</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
            <div>
              <input placeholder="開始ノード" value={startText} onChange={(e) => setStartText(e.target.value)} style={{ width: '100%', border: '1px solid #ddd', borderRadius: 6, padding: '6px 8px' }} />
              {startText && (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', width: '100%', maxHeight: 160, overflow: 'auto', borderRadius: 6 }}>
                    {startSugg.map(s => (
                      <div key={s.id} style={{ padding: '6px 8px', cursor: 'pointer' }} onClick={() => { setStartId(s.id); setStartText(s.name); }}>
                        {s.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <input placeholder="終了ノード" value={endText} onChange={(e) => setEndText(e.target.value)} style={{ width: '100%', border: '1px solid #ddd', borderRadius: 6, padding: '6px 8px' }} />
              {endText && (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', width: '100%', maxHeight: 160, overflow: 'auto', borderRadius: 6 }}>
                    {endSugg.map(s => (
                      <div key={s.id} style={{ padding: '6px 8px', cursor: 'pointer' }} onClick={() => { setEndId(s.id); setEndText(s.name); }}>
                        {s.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => computePath()} style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>探索</button>
            <button onClick={() => { setStartId(null); setEndId(null); setStartText(""); setEndText(""); setHighlightEdges([]); setHighlightNodeIds([]); }} style={{ border: '1px solid #ddd', background: '#f8fafc', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>クリア</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>グラフ上のノードをクリックすると、未設定の開始/終了に自動でセットします。</div>
        </div>

        <div style={{ flex: '1 1 220px', minWidth: 220, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>サマリ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>省庁数</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{topLevels.length}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>表示ノード</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{filteredNodes.length}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px' }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>表示リンク</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{filteredLinks.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <ForceGraph
          nodes={filteredNodes}
          links={filteredLinks}
          colorMap={colorMap}
          nodeSizeByGroup={NODE_SIZE_BY_GROUP}
          isMobile={isMobile}
          width={typeof window !== 'undefined' ? Math.max(320, window.innerWidth - 48) : undefined}
          height={typeof window !== 'undefined' ? (isMobile ? Math.max(300, window.innerHeight - 160) : Math.round(window.innerHeight * 0.8)) : undefined}
          showTopLevelLabels
          highlightNodeIds={highlightNodeIds}
          highlightEdges={highlightEdges}
          onNodeClick={(d) => {
            if (!startId) { setStartId(d.id); setStartText(d.name); return; }
            if (!endId) { setEndId(d.id); setEndText(d.name); computePath(d.id); return; }
            // if both already set, navigate to subgraph as a convenience
            window.location.href = `/subgraph?node=${encodeURIComponent(d.id)}`;
          }}
          svgStyle={{ display: 'block' }}
        />
      </div>
    </div>
  );
};

export default ExplorePage;
