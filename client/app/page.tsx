"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import Fuse from 'fuse.js';
import ForceGraph from '../components/Graph/ForceGraph';
import Controls from '../components/Graph/Controls';
import { useMainGraphData } from '../hooks/useGraphData';

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

const Page: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // agency filter
  const [visibleAgencies, setVisibleAgencies] = useState<string[]>([]);
  const { nodes, links, colorMap, loading, error, allAgencies, limitedNodes } = useMainGraphData(visibleAgencies);

  // initialize visible agencies once data arrives
  useEffect(() => {
    if (allAgencies && allAgencies.length && visibleAgencies.length === 0) {
      setVisibleAgencies(allAgencies);
    }
  }, [allAgencies, visibleAgencies.length]);

  // spotlight search
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [search, setSearch] = useState('');
  const [currentHit, setCurrentHit] = useState(0);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const fuse = useMemo(() => {
    return new Fuse(limitedNodes, {
      keys: ['name', 'yomi'],
      threshold: 0.4,
      minMatchCharLength: 1,
      ignoreLocation: true,
      useExtendedSearch: true,
    });
  }, [limitedNodes]);

  const results = useMemo(() => {
    if (!search) return [] as { id: string; name: string }[];
    return fuse.search(search).map(r => ({ id: r.item.id, name: r.item.name }));
  }, [fuse, search]);

  useEffect(() => { setCurrentHit(0); }, [search]);

  // zoom control
  const zoomRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>データを読み込んでいます...</div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'crimson' }}>エラー: {error}</div>
    );
  }

  return (
    <div style={{ width: '100vw', height: isMobile ? '100dvh' : '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
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
        onPickResult={(id, index) => {
          setCurrentHit(index);
          setShowSpotlight(false);
          setFocusedNodeId(id);
        }}
        agencies={allAgencies}
        visibleAgencies={visibleAgencies}
        onToggleAgency={(agency, next) => {
          setVisibleAgencies(prev => next ? Array.from(new Set([...prev, agency])) : prev.filter(a => a !== agency));
        }}
      />

      <ForceGraph
        nodes={nodes}
        links={links}
        colorMap={colorMap}
        nodeSizeByGroup={NODE_SIZE_BY_GROUP}
        isMobile={isMobile}
        focusedNodeId={results.length ? results[currentHit]?.id ?? null : focusedNodeId}
        onNodeClick={(d) => {
          window.location.href = `/subgraph?node=${encodeURIComponent(d.id)}`;
        }}
        onBackgroundClick={() => setFocusedNodeId(null)}
        onZoomReady={(z) => { zoomRef.current = z; }}
        svgStyle={{ position: 'absolute', top: isMobile ? 56 : 0, left: 0, zIndex: 1, width: '100vw', height: isMobile ? 'calc(100vh - 56px)' : '100vh' }}
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
    </div>
  );
};

export default Page;
