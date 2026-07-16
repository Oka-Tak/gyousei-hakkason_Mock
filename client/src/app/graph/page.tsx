"use client";

import React, { Suspense, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import LoadingOverlay from '@/components/common/LoadingOverlay';
import Controls from '@/components/graph/Controls';
import ForceGraph, { type ForceGraphHandle } from '@/components/graph/ForceGraph';
import ZoomControls from '@/components/graph/ZoomControls';
import { NODE_SIZE_BY_GROUP } from '@/features/graph/constants';
import { useMainGraphData } from '@/features/graph/hooks/useGraphData';
import { useIsMobile } from '@/hooks/useIsMobile';

const NAV_LINKS = [
  { href: '/', label: 'ホーム' },
  { href: '/explore', label: '探索' },
  { href: '/compare', label: '比較' },
  { href: '/agencies', label: '省庁一覧' },
  { href: '/company', label: '企業・受取先' },
  { href: '/policy', label: '政策・法令ナビ' },
  { href: '/outcomes', label: '目標と実績' },
  { href: '/insight', label: 'インサイト' },
];

const GraphPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const isMobile = useIsMobile();

  const [visibleAgencies, setVisibleAgencies] = useState<string[] | null>(null);
  const { nodes, links, colorMap, loading, error, allAgencies } = useMainGraphData(visibleAgencies);

  const [showSpotlight, setShowSpotlight] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [currentHit, setCurrentHit] = useState(0);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const fuse = useMemo(() => new Fuse(nodes, { keys: ['name', 'yomi'], threshold: 0.4, minMatchCharLength: 1, ignoreLocation: true, useExtendedSearch: true }), [nodes]);
  const results = useMemo(() => (search ? fuse.search(search).slice(0, 50).map(r => ({ id: r.item.id, name: r.item.name })) : []), [fuse, search]);

  const graphRef = useRef<ForceGraphHandle | null>(null);
  const activeAgencies = visibleAgencies ?? allAgencies ?? [];

  if (loading) return (<LoadingOverlay title="ZAIMYAKU" message="データを読み込んでいます..." variant="pulse" dotsCount={3} />);
  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16, padding: 20 }}>
      <div style={{ color: '#dc2626', fontSize: 18, fontWeight: 600 }}>データの読み込みに失敗しました</div>
      <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>{error}</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => window.location.reload()}
          style={{ background: '#07796b', color: '#fff', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          再読み込み
        </button>
        <Link href="/" style={{ background: '#f1f5f9', color: '#334155', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          ホームに戻る
        </Link>
      </div>
    </div>
  );

  return (
    <div style={{ width: '100vw', height: '100dvh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      <Controls
        isMobile={isMobile}
        showSpotlight={showSpotlight}
        onOpenSpotlight={() => setShowSpotlight(true)}
        onCloseSpotlight={() => setShowSpotlight(false)}
        search={search}
        onChangeSearch={(value) => { setSearch(value); setCurrentHit(0); }}
        currentIndex={currentHit}
        hitsCount={results.length}
        onPrev={() => results.length && setCurrentHit((currentHit - 1 + results.length) % results.length)}
        onNext={() => results.length && setCurrentHit((currentHit + 1) % results.length)}
        results={results}
        onPickResult={(id, index) => { setCurrentHit(index); setShowSpotlight(false); setFocusedNodeId(id); }}
        agencies={allAgencies}
        visibleAgencies={activeAgencies}
        onToggleAgency={(agency, next) => setVisibleAgencies((current) => {
          const base = current ?? allAgencies ?? [];
          return next ? Array.from(new Set([...base, agency])) : base.filter((item) => item !== agency);
        })}
      />

      <nav
        aria-label="ZAIMYAKU ページナビゲーション"
        style={{
          position: 'absolute',
          top: isMobile ? 64 : 78,
          right: isMobile ? 10 : 28,
          zIndex: 15,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          maxWidth: isMobile ? '90vw' : 420,
          justifyContent: isMobile ? 'flex-start' : 'flex-end',
        }}
      >
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="navLinkButton">
            {link.label}
          </Link>
        ))}
      </nav>

      <ForceGraph
        ref={graphRef}
        nodes={nodes}
        links={links}
        colorMap={colorMap}
        nodeSizeByGroup={NODE_SIZE_BY_GROUP}
        showTopLevelLabels
        isMobile={isMobile}
        focusedNodeId={results.length ? results[currentHit]?.id ?? null : focusedNodeId}
        onNodeClick={(d) => { window.location.href = `/subgraph?node=${encodeURIComponent(d.id)}`; }}
        onBackgroundClick={() => setFocusedNodeId(null)}
        svgStyle={{ position: 'absolute', top: isMobile ? 56 : 0, left: 0, zIndex: 1, width: '100vw', height: isMobile ? 'calc(100dvh - 56px)' : '100dvh' }}
      />

      <ZoomControls graphRef={graphRef} isMobile={isMobile} />
    </div>
  );
};

const GraphPage: React.FC = () => {
  return (
    <Suspense fallback={<LoadingOverlay title="ZAIMYAKU" message="ページを読み込んでいます..." variant="pulse" dotsCount={3} />}>
      <GraphPageContent />
    </Suspense>
  );
};

export default GraphPage;
