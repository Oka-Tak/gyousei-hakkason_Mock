"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { useSearchParams } from 'next/navigation';
import ForceGraph, { type ForceGraphHandle } from '@/components/graph/ForceGraph';
import ZoomControls from '@/components/graph/ZoomControls';
import Controls from '@/components/graph/Controls';
import { useSubgraphData } from '@/features/graph/hooks/useGraphData';
import NodeDetails from '@/components/graph/NodeDetails';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import { NODE_SIZE_BY_GROUP } from '@/features/graph/constants';
import type { GraphNodeDatum } from '@/features/graph/types';
import type { SpendingItem } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';

function SubgraphContent() {
  const isMobile = useIsMobile();

  const searchParams = useSearchParams();
  const nodeId = searchParams.get('node');
  const { nodes, links, colorMap, loading, error } = useSubgraphData(nodeId);

  const [showSpotlight, setShowSpotlight] = useState(false);
  const [search, setSearch] = useState('');
  const [currentHit, setCurrentHit] = useState(0);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeDatum | null>(null);
  const [loadingSpending, setLoadingSpending] = useState(false);
  const [spendingError, setSpendingError] = useState<string | null>(null);
  const spendingCacheRef = useRef(new Map<string, SpendingItem[]>());
  const spendingRequestRef = useRef<AbortController | null>(null);

  const fuse = useMemo(() => new Fuse(nodes, { keys: ['name', 'yomi'], threshold: 0.4, minMatchCharLength: 1, ignoreLocation: true }), [nodes]);
  const results = useMemo(() => search ? fuse.search(search).slice(0, 50).map(r => ({ id: r.item.id, name: r.item.name })) : [], [fuse, search]);

  const graphRef = useRef<ForceGraphHandle | null>(null);

  const showNodeDetails = useCallback(async (node: GraphNodeDatum) => {
    spendingRequestRef.current?.abort();
    setSelectedNode(node);
    setFocusedNodeId(node.id);
    setLoadingSpending(false);
    setSpendingError(null);
    if (node.group !== 'project_name' || !node.project_id) return;

    const cached = spendingCacheRef.current.get(node.project_id);
    if (cached) {
      setSelectedNode({ ...node, spending_list: cached });
      return;
    }

    const controller = new AbortController();
    spendingRequestRef.current = controller;

    try {
      setLoadingSpending(true);
      const response = await fetch(
        `/api/project_spending?projectId=${encodeURIComponent(node.project_id)}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json() as { spending_list?: SpendingItem[] };
      if (controller.signal.aborted) return;
      const spendingList = json.spending_list ?? [];
      spendingCacheRef.current.set(node.project_id, spendingList);
      setSelectedNode({ ...node, spending_list: spendingList });
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setSpendingError(error instanceof Error ? error.message : '支払先データの取得に失敗しました');
      }
    } finally {
      if (spendingRequestRef.current === controller) {
        spendingRequestRef.current = null;
        setLoadingSpending(false);
      }
    }
  }, []);

  useEffect(() => () => spendingRequestRef.current?.abort(), []);

  const closeNodeDetails = useCallback(() => {
    spendingRequestRef.current?.abort();
    setSelectedNode(null);
    setFocusedNodeId(null);
    setLoadingSpending(false);
    setSpendingError(null);
  }, []);

  if (loading) return (<LoadingOverlay title="ZAIMYAKU" message="サブグラフを構築中..." variant="bounce" dotsCount={4} />);
  if (error) return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'crimson' }}>エラー: {error}</div>);

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
        onPickResult={async (id, index) => {
          setCurrentHit(index); setShowSpotlight(false); setFocusedNodeId(id);
          const node = nodes.find((item) => item.id === id);
          if (node) await showNodeDetails(node);
        }}
      />

      <button onClick={() => window.history.back()} style={{ position: 'absolute', right: 16, top: 12, zIndex: 20, background: '#07796b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>戻る</button>

      <ForceGraph
        ref={graphRef}
        nodes={nodes}
        links={links}
        colorMap={colorMap}
        nodeSizeByGroup={NODE_SIZE_BY_GROUP}
        isMobile={isMobile}
        focusedNodeId={results.length ? results[currentHit]?.id ?? null : focusedNodeId}
        onNodeClick={(node) => { void showNodeDetails(node); }}
        onBackgroundClick={closeNodeDetails}
        svgStyle={{ position: 'absolute', top: isMobile ? 100 : 0, left: 0, zIndex: 1, width: '100vw', height: isMobile ? 'calc(100dvh - 100px)' : '100dvh' }}
      />

      <ZoomControls graphRef={graphRef} isMobile={isMobile} />

      {selectedNode && (
        <NodeDetails
          node={selectedNode}
          isMobile={isMobile}
          loadingSpending={loadingSpending}
          spendingError={spendingError}
          onClose={closeNodeDetails}
        />
      )}
    </div>
  );
}

const SubgraphPage: React.FC = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <SubgraphContent />
  </Suspense>
);

export default SubgraphPage;
