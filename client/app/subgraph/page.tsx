"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import Fuse from 'fuse.js';
import { useSearchParams } from 'next/navigation';
import ForceGraph from '../../components/Graph/ForceGraph';
import Controls from '../../components/Graph/Controls';
import { useSubgraphData } from '../../hooks/useGraphData';
import NodeDetails from '../../components/Graph/NodeDetails';

const NODE_SIZE_BY_GROUP: Record<string, number> = {
  agency_name: 36,
  ministry_name: 24,
  bureau_agency: 18,
  department: 14,
  division: 11,
  office: 9,
  section: 7,
  group: 6,
  team: 5,
  project_name: 4,
  unknown: 4,
};

function SubgraphContent() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const searchParams = useSearchParams();
  const nodeId = searchParams.get('node');
  const { nodes, links, colorMap, loading, error, limitedNodes } = useSubgraphData(nodeId);

  const [showSpotlight, setShowSpotlight] = useState(false);
  const [search, setSearch] = useState('');
  const [currentHit, setCurrentHit] = useState(0);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const fuse = useMemo(() => new Fuse(limitedNodes, { keys: ['name', 'yomi'], threshold: 0.4, minMatchCharLength: 1, ignoreLocation: true }), [limitedNodes]);
  const results = useMemo(() => search ? fuse.search(search).map(r => ({ id: r.item.id, name: r.item.name })) : [], [fuse, search]);
  useEffect(() => { setCurrentHit(0); }, [search]);

  const zoomRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>サブグラフを構築中...</div>;
  if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'crimson' }}>エラー: {error}</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      <Controls
        isMobile={isMobile}
        showSpotlight={showSpotlight}
        onOpenSpotlight={() => setShowSpotlight(true)}
        onCloseSpotlight={() => setShowSpotlight(false)}
        search={search}
        onChangeSearch={setSearch}
        currentIndex={currentHit}
        hitsCount={results.length}
        onPrev={() => results.length && setCurrentHit((currentHit - 1 + results.length) % results.length)}
        onNext={() => results.length && setCurrentHit((currentHit + 1) % results.length)}
        results={results}
        onPickResult={(id, index) => { setCurrentHit(index); setShowSpotlight(false); setFocusedNodeId(id); const n = nodes.find(n=>n.id===id); if(n) setSelectedNode(n); }}
      />

      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        style={{ position: 'absolute', right: 16, top: 12, zIndex: 20, background: '#07796b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
      >戻る</button>

      <ForceGraph
        nodes={nodes}
        links={links}
        colorMap={colorMap}
        nodeSizeByGroup={NODE_SIZE_BY_GROUP}
        isMobile={isMobile}
        focusedNodeId={results.length ? results[currentHit]?.id ?? null : focusedNodeId}
        onNodeClick={(d) => { setSelectedNode(d); setFocusedNodeId(d.id); }}
        onBackgroundClick={() => { setFocusedNodeId(null); setSelectedNode(null); }}
        onZoomReady={(z) => { zoomRef.current = z; }}
        svgStyle={{ position: 'absolute', top: isMobile ? 100 : 0, left: 0, zIndex: 1, width: '100vw', height: isMobile ? 'calc(100vh - 100px)' : '100vh' }}
      />

      {/* zoom buttons */}
      <div style={{ position: 'absolute', left: isMobile ? 10 : 20, bottom: isMobile ? 10 : 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          style={{ width: 40, height: 40, borderRadius: 8, fontSize: 24, background: '#fff', border: '1px solid #ccc', cursor: 'pointer', marginBottom: 2 }}
          onClick={() => {
            const svg = document.querySelector('svg');
            if (svg && zoomRef.current) d3.select(svg as unknown as Element).transition().duration(200).call((zoomRef.current as any).scaleBy, 1.2);
          }}
          aria-label="拡大"
        >＋</button>
        <button
          style={{ width: 40, height: 40, borderRadius: 8, fontSize: 24, background: '#fff', border: '1px solid #ccc', cursor: 'pointer', marginBottom: 2 }}
          onClick={() => {
            const svg = document.querySelector('svg');
            if (svg && zoomRef.current) d3.select(svg as unknown as Element).transition().duration(200).call((zoomRef.current as any).scaleBy, 1/1.2);
          }}
          aria-label="縮小"
        >－</button>
        <button
          style={{ width: 40, height: 40, borderRadius: 8, fontSize: 20, background: '#fff', border: '1px solid #ccc', cursor: 'pointer' }}
          onClick={() => {
            const svg = document.querySelector('svg');
            if (svg && zoomRef.current) d3.select(svg as unknown as Element).transition().duration(300).call((zoomRef.current as any).transform, d3.zoomIdentity.translate(0, 0).scale(1));
          }}
          aria-label="中心に戻る"
        >⦿</button>
      </div>

      {selectedNode && (
        <NodeDetails node={selectedNode} isMobile={isMobile} onClose={() => { setSelectedNode(null); setFocusedNodeId(null); }} />
      )}
    </div>
  );
}

const SubgraphPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SubgraphContent />
    </Suspense>
  );
};

export default SubgraphPage;
