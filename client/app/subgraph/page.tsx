"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { RawProjectData, SpendingItem } from '../../src/types';
import Fuse from 'fuse.js';

// 型ガード関数
function isRawProjectData(item: any): item is RawProjectData {
  return typeof item === 'object' && 
         (typeof item.project_id === 'string' || item.project_id === undefined) &&
         (typeof item.agency_name === 'string' || item.agency_name === undefined) &&
         (typeof item.ministry_name === 'string' || item.ministry_name === undefined);
}
// d3は既にimport済み
// メイングラフと同じカラーマップ関数を利用
import * as d3 from "d3";
function getDistinctColorMap(keys: string[]): Record<string, string> {
  const n = keys.length;
  const colorMap: Record<string, string> = {};
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const hue = 360 * t;
    colorMap[keys[i]] = d3.hcl(hue, 80, 65).toString();
  }
  return colorMap;
}
import spotlightStyles from '../../src/app/SpotlightSearch.module.css'; // Import the CSS module
import buttonStyles from '../../src/app/Button.module.css'; // Import the CSS module
import { useSearchParams } from "next/navigation";

// 階層名リスト（事業名まで含む）
const hierarchyNames = [
  "bureau_agency",
  "department",
  "division",
  "office",
  "section",
  "group",
  "team",
  "project_name",
];

const nodeSizeByGroup: { [key: string]: number } = {
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform | null>(null);
  const [data, setData] = useState<RawProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<any | null>(null);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [search, setSearch] = useState('');
  const [hitIndexes, setHitIndexes] = useState<number[]>([]);
  const [currentHit, setCurrentHit] = useState(0);
  const [limitedNodesState, setLimitedNodesState] = useState<any[]>([]);

  // レスポンシブ: 画面幅を取得
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 600;
      setIsMobile(mobile);
      if (mobile) {
        console.log('[レスポンシブ] モバイルモード');
      } else {
        console.log('[レスポンシブ] PCモード');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // focusedNodeのデバッグ出力（1つだけ、関数本体の先頭に配置）
  React.useEffect(() => {
    if (focusedNode) {
      console.log('focusedNode debug:', focusedNode);
    }
  }, [focusedNode]);
  const searchParams = useSearchParams();
  const nodeId = searchParams.get("node");

  useEffect(() => {
    const fetchData = async () => {
      if (!nodeId) {
        setError("ノードIDが指定されていません");
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/subgraph?node=${encodeURIComponent(nodeId)}`);
        if (!response.ok) throw new Error("データ取得失敗");
        const merged = await response.json();
        setData(merged);
        console.log(`[データ取得] 件数: ${Array.isArray(merged) ? merged.length : (merged?.length ?? '不明')}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [nodeId]);

  // Spotlightショートカット
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSpotlight((v) => !v);
      }
      if (e.key === 'Escape') setShowSpotlight(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Fuse.jsによる日本語あいまい検索（nameとyomi両方を対象）
  useEffect(() => {
    if (!search || !limitedNodesState.length) {
      setHitIndexes([]);
      setCurrentHit(0);
      return;
    }
    const fuse = new Fuse(limitedNodesState, {
      keys: ['name', 'yomi'],
      threshold: 0.4,
      minMatchCharLength: 1,
      ignoreLocation: true,
      useExtendedSearch: true,
    });
    const results = fuse.search(search);
    const hits = results.map(res => limitedNodesState.findIndex(n => n.id === res.item.id));
    setHitIndexes(hits);
    setCurrentHit(0);
  }, [search, limitedNodesState]);

  useEffect(() => {
    if (!data.length || !svgRef.current || !nodeId) return;
    // nodeIdで始まる階層のデータのみ抽出
    const filtered = data.filter(item => {
      let topLevel = item["agency_name"] || item["ministry_name"];
      // nullな階層はスキップ
      const rest = hierarchyNames.map(k => item[k]).filter(v => v != null && v !== "");
      const hierarchy = [topLevel, ...rest];
      const id = hierarchy.join("→");
      return id.startsWith(nodeId) || nodeId.startsWith(id);
    });
    // ノード・リンク生成（事業名まで含む）
    const nodes: any[] = [];
    const nodeMap = new Map<string, any>();
    const aggregatedBudgets = new Map<string, number>();
    const aggregatedLinkBudgets = new Map<string, Map<string, number>>();
    filtered.forEach(item => {
      let topLevel = item["agency_name"] || item["ministry_name"];
      let topLevelKey = item["agency_name"] ? "agency_name" : "ministry_name";
      // nullな階層はスキップ
      const rest = hierarchyNames.map(k => item[k]).filter(v => v != null && v !== "");
      const restYomi = hierarchyNames.map(k => item[k + '_yomi']).filter((v, i) => item[hierarchyNames[i]] != null && item[hierarchyNames[i]] !== "");
      const hierarchy = [topLevel, ...rest];
      const hierarchyYomi = [item[topLevelKey + '_yomi'], ...restYomi];
      let parentNodeId: string | null = null;
      let nodePath: string[] = [];
      let nodePathYomi: string[] = [];
      const currentBudget = Number(item.initial_budget_total) || 0;
      const url = item["review_sheet_url"] || "#";
      hierarchy.forEach((name, index) => {
        nodePath.push(name);
        nodePathYomi.push(hierarchyYomi[index] || '');
        const nodeId = nodePath.join("→");
        const nodeYomi = nodePathYomi.join("→");
        // groupNameは階層スキップ後のindexで決定
        const groupName = (index === 0)
          ? topLevelKey
          : (index - 1 < rest.length ? hierarchyNames[index - 1] : 'project_name');
        // 最後のノードは必ずproject_nameにする
        const isProjectNode = (index === hierarchy.length - 1);
        const finalGroup = isProjectNode ? 'project_name' : groupName;
        if (!nodeMap.has(nodeId)) {
          const newNode = {
            id: nodeId,
            name: name,
            yomi: nodeYomi,
            group: finalGroup,
            value: 0,
            initial_budget: item.initial_budget_total || 0,
            url: url,
            topLevel: topLevel,
            project_id: isProjectNode ? String(item.project_id ?? '') : '',
            spending_list: item.spending_list || [],
          };
          nodes.push(newNode);
          nodeMap.set(nodeId, newNode);
        }
        // 予算集計
        aggregatedBudgets.set(nodeId, (aggregatedBudgets.get(nodeId) || 0) + currentBudget);
        if (parentNodeId) {
          const sourceNode = nodeMap.get(parentNodeId);
          const targetNode = nodeMap.get(nodeId);
          if (sourceNode && targetNode) {
            if (!aggregatedLinkBudgets.has(sourceNode.id)) {
              aggregatedLinkBudgets.set(sourceNode.id, new Map<string, number>());
            }
            const targetMap = aggregatedLinkBudgets.get(sourceNode.id)!;
            targetMap.set(targetNode.id, (targetMap.get(targetNode.id) || 0) + currentBudget);
          }
        }
        parentNodeId = nodeId;
      });
    });
    // ノードに金額を反映
    nodes.forEach(node => {
      node.value = aggregatedBudgets.get(node.id) || 0;
      node.initial_budget = aggregatedBudgets.get(node.id) || 0;
    });
    // リンク生成
    const links: any[] = [];
    aggregatedLinkBudgets.forEach((targetMap, sourceId) => {
      targetMap.forEach((budget, targetId) => {
        const sourceNode = nodeMap.get(sourceId);
        const targetNode = nodeMap.get(targetId);
        if (sourceNode && targetNode) {
          links.push({ source: sourceNode, target: targetNode, value: budget });
        }
      });
    });
    setLimitedNodesState(nodes);
    // D3描画
      // レスポンシブ: SVGサイズ調整
    const width = window.innerWidth;
    const height = isMobile ? window.innerHeight - 120 : window.innerHeight;
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("max-width", isMobile ? "100vw" : "")
      .style("min-width", isMobile ? "0" : "")
      .html("");
    // --- D3ズーム機能 ---
    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');
    const linkGroup = zoomLayer.append('g').attr('class', 'links');
    const nodeGroup = zoomLayer.append('g').attr('class', 'nodes');
    const minZoom = 0.1;
    const maxZoom = 4;
    const initialZoom = 1;
    const zoomed = (event: d3.D3ZoomEvent<Element, unknown>) => {
      zoomLayer.attr('transform', event.transform.toString());
      setZoomTransform(event.transform);
    };
    const zoom = d3.zoom<Element, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .on('zoom', zoomed);
    zoomRef.current = zoom;
    svg.call(zoom as any);
    svg.call((zoom as any).transform, d3.zoomIdentity.translate(0, 0).scale(initialZoom));
    // ---
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', 'solid')
      .style('border-width', '1px')
      .style('border-radius', '5px')
      .style('padding', isMobile ? '6px' : '10px')
      .style('font-size', isMobile ? '13px' : 'inherit')
      .style('max-width', isMobile ? '90vw' : '300px')
      .style('word-break', 'break-all');
    // エッジの太さの最小値と最大値を定義
    const minEdgeWidth = 1.5;
    const maxEdgeWidth = 30;

    // リンクの予算額の最小値と最大値を計算
    const minLinkValue = d3.min(links, d => d.value) || 0;
    const maxLinkValue = d3.max(links, d => d.value) || 1; // 0除算を避けるため最低1

    // 予算額をエッジの太さにマッピングするスケール関数
    const edgeWidthScale = d3.scaleLinear()
      .domain([minLinkValue, maxLinkValue])
      .range([minEdgeWidth, maxEdgeWidth]);

    const link = linkGroup.selectAll('line').data(links).join('line')
      .attr('stroke', '#999')
      .attr('stroke-width', d => edgeWidthScale(d.value))
      .attr('stroke-opacity', 0.6);

    // --- カラーマップ・アイコン ---
    const topLevelKeys = Array.from(new Set(nodes.map(n => n.topLevel)));
    const colorMap = getDistinctColorMap(topLevelKeys);
    const iconPaths: Record<string, string> = {
      ministry_name: 'M4 20h16v-2H4v2zm1-4h14V8l-7-5-7 5v8z',
      bureau_agency: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 8h2v-2H7v2zm0-4h2v-2H7v2zm0-4h2V7H7v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2z',
      department: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
      division: 'M12 7V3H2v18h20V7H12zm0 2h8v10H4V5h8v4z',
      office: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
      section: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2z',
      group: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
      team: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C17 13.17 12.33 12 10 12zm8 0c-.29 0-.62.02-.97.05C17.64 13.1 19 14.28 19 15.5V19h4v-2.5c0-2.33-4.67-3.5-7-3.5z',
      project_name: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
      unknown: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-2.83.48-5.48-1.51-5.96-4.34-.09-.52.36-.99.89-.99.45 0 .83.3.93.73.34 1.5 1.72 2.57 3.24 2.57 1.52 0 2.9-1.07 3.24-2.57.1-.43.48-.73.93-.73.53 0 .98.47.89.99-.48 2.83-3.13 4.82-5.96 4.34z',
    };

    // ノードグループ
    const nodeEnter = nodeGroup.selectAll('g').data(nodes).join('g').attr('class', 'node-group')
      .call(d3.drag<any, any>()
        .on('start', function (event: any, d: any) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', function (event: any, d: any) {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', function (event: any, d: any) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // まず全ノードに円を描画
    nodeEnter.append('circle')
      .attr('r', d => nodeSizeByGroup[d.group] || 8)
      .attr('fill', d => colorMap[d.topLevel || ''] || '#1976d2')
      .attr('stroke', '#fff').attr('stroke-width', 1.5);

    // 政策所管府省庁（agency_name）は円の中に省庁名テキストを白色で中央表示
    nodeEnter.filter(d => d.group === 'agency_name')
      .append('text')
      .text(d => {
        const r = nodeSizeByGroup[d.group] || 8;
        const maxWidth = r * 2 * 0.85;
        const charWidth = 0.6;
        const maxChars = Math.floor(maxWidth / (r * 0.55 * charWidth));
        if (!d.name) return '';
        return d.name.length > maxChars ? d.name.slice(0, maxChars - 1) + '…' : d.name;
      })
      .attr('font-size', d => {
        const r = nodeSizeByGroup[d.group] || 8;
        const name = d.name || '';
        const base = r * 2 * 0.85;
        const size = Math.max(8, Math.min(r * 0.6, base / (name.length * 0.65)));
        return `${size}px`;
      })
      .attr('fill', '#fff')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('pointer-events', 'none');

    // 他ノードは白いアイコンを重ねる
    nodeEnter.filter(d => d.group !== 'agency_name')
      .append('path')
      .attr('d', d => iconPaths[d.group] || iconPaths['unknown'])
      .attr('fill', '#fff')
      .attr('stroke', 'none')
      .attr('transform', d => {
        const r = nodeSizeByGroup[d.group] || 8;
        return `scale(${r/12*0.7}) translate(-12,-12)`;
      });

    nodeEnter.append('title').text(d => d.name);
    nodeEnter
      .on('mouseover', (event, d) => {
        tooltip.transition().duration(200).style('opacity', .9);
        tooltip.html(`
          <strong>${d.name}</strong><br/>
          予算額: ${d.initial_budget?.toLocaleString()}円<br/>
          <a href="${d.url}" target="_blank">レビューシートURL</a>
        `);
        const svgRect = svgRef.current?.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const tooltipWidth = 180;
        const tooltipHeight = 80;
        let left = mouseX + 20;
        let top = mouseY - tooltipHeight / 2;
        if (svgRect) {
          if (left + tooltipWidth > svgRect.right) left = svgRect.right - tooltipWidth - 10;
          if (top < svgRect.top) top = svgRect.top + 10;
          if (top + tooltipHeight > svgRect.bottom) top = svgRect.bottom - tooltipHeight - 10;
        }
        tooltip.style('left', left + 'px').style('top', top + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      })
      .on('click', (event, d) => {
        setFocusedNode(d);
        // --- フォーカス時に接続ノード以外を灰色・薄く ---
        const svg = d3.select(svgRef.current);
        const connectedIds = new Set([d.id]);
        links.forEach(l => {
          if (l.source.id === d.id) connectedIds.add(l.target.id);
          if (l.target.id === d.id) connectedIds.add(l.source.id);
        });
        svg.selectAll('.node-group').select('circle')
          .attr('fill', n => connectedIds.has((n as any).id) ? (colorMap[(n as any).topLevel || ''] || '#1976d2') : '#ccc');
        svg.selectAll('.node-group').select('path')
          .attr('fill', n => connectedIds.has((n as any).id) ? '#fff' : '#eee');
        svg.selectAll('.node-group').select('text')
          .attr('opacity', n => connectedIds.has((n as any).id) ? 1 : 0.15);
        link.attr('opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.07);
        event.stopPropagation();
      });
    // SVG背景クリックでハイライト解除
    svg.on('click', () => {
      setFocusedNode(null);
      // ハイライト解除
      const svgEl = d3.select(svgRef.current);
      svgEl.selectAll('.node-group').select('circle')
  .attr('fill', n => colorMap[(n as any).topLevel || ''] || '#1976d2');
      svgEl.selectAll('.node-group').select('path')
        .attr('fill', '#fff');
      svgEl.selectAll('.node-group').select('text')
        .attr('opacity', 1);
      link.attr('opacity', 0.6);
    });
    // tick
    // forceLink距離・charge強度をモバイル時は短く/弱く
    const linkDistance = isMobile ? 18 : 30;
    const chargeStrength = isMobile ? -120 : -400;
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(linkDistance))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2));
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      nodeEnter.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    // クリーンアップ
    return () => { tooltip.remove(); svg.on('.zoom', null); };
  }, [data, nodeId]);

  // Spotlightで選択中のノードを拡大・中央フォーカス
  useEffect(() => {
    if (!showSpotlight || hitIndexes.length === 0 || !svgRef.current || !limitedNodesState.length) return;
    const idx = hitIndexes[currentHit];
    const node = limitedNodesState[idx];
    if (!node) return;
    const svg = d3.select(svgRef.current);
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    if (zoomRef.current) {
      const scale = 1.8;
      const tx = window.innerWidth / 2 - x * scale;
      const ty = window.innerHeight / 2 - y * scale;
      svg.transition().duration(400).call((zoomRef.current as any).transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
    // ノード・リンクのハイライト
    svg.selectAll('.node-group').select('circle')
      .attr('stroke', (d: any) => d.id === node.id ? '#e17055' : '#fff')
      .attr('stroke-width', (d: any) => d.id === node.id ? 6 : 1.5)
      .attr('r', (d: any) => d.id === node.id ? 1.5 * (nodeSizeByGroup[d.group as string] || 8) : (nodeSizeByGroup[d.group as string] || 8))
      .attr('opacity', (d: any) => d.id === node.id ? 1 : 0.15);
    svg.selectAll('.node-group').select('text')
      .attr('opacity', (d: any) => d.id === node.id ? 1 : 0.15);
    svg.selectAll('.links line')
      .attr('opacity', (l: any) => (l.source.id === node.id || l.target.id === node.id) ? 1 : 0.07);
    setTimeout(() => {
      svg.selectAll('.node-group').select('circle')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('r', (d: any) => nodeSizeByGroup[d.group as string] || 8)
        .attr('opacity', 1);
      svg.selectAll('.node-group').select('text').attr('opacity', 1);
      svg.selectAll('.links line').attr('opacity', 0.6);
    }, 1000);
  }, [showSpotlight, hitIndexes, currentHit, limitedNodesState]);

  if (loading) return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24
      }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#07796b',
          margin: 0,
          letterSpacing: '0.05em'
        }}>ZAIMYAKU</h1>
        
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center'
        }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: '#07796b',
                animation: `bounce 1.4s infinite ${i * 0.15}s`
              }}
            />
          ))}
        </div>
        
        <p style={{
          fontSize: 16,
          color: '#64748b',
          margin: 0,
          textAlign: 'center'
        }}>サブグラフを構築中...</p>
      </div>
      
      <style jsx>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
  
  if (error) return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 32,
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        maxWidth: 400
      }}>
        <div style={{ fontSize: 48 }}>❌</div>
        <h2 style={{
          fontSize: 20,
          fontWeight: 600,
          color: '#dc2626',
          margin: 0
        }}>データ取得エラー</h2>
        <p style={{
          fontSize: 14,
          color: '#64748b',
          margin: 0,
          textAlign: 'center'
        }}>{error}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#07796b',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >再試行</button>
          <button
            onClick={() => window.history.back()}
            style={{
              background: 'transparent',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >戻る</button>
        </div>
      </div>
    </div>
  );
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      {/* --- タイトル・検索・戻るボタンのレイアウト --- */}
      <div
        style={isMobile ? {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          zIndex: 10,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '12px 0 8px 0',
        } : {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          zIndex: 10,
          background: '#fff',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: '8px 0',
        }}
      >
        <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 22, flex: 'none' }}>ZAIMYAKU - サブグラフ</h2>
        <button
          style={isMobile ? {
            marginTop: 2,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: '6px 16px',
            fontSize: 15,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            alignSelf: 'center',
          } : {
            marginLeft: 24,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 18,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: 'pointer',
          }}
          onClick={() => setShowSpotlight(true)}
          aria-label="検索を開く"
        >🔍 検索</button>
        <button
          className={buttonStyles.backButton}
          style={isMobile ? {
            position: 'static',
            marginTop: 2,
            fontSize: 14,
            padding: '7px 10px',
            alignSelf: 'center',
          } : {}}
          onClick={() => window.history.back()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
          戻る
        </button>
      </div>
      {/* --- Spotlight風検索UI --- */}
      {showSpotlight && (
        <div className={spotlightStyles.spotlightContainer} style={{ position: 'absolute', top: isMobile ? 85 : 80, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <input
            autoFocus
            type="text"
            placeholder="ノード名で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={spotlightStyles.searchInput}
          />
          <div className={spotlightStyles.controls}>
            <button className={spotlightStyles.controlButton} onClick={() => setCurrentHit((h) => (h - 1 + hitIndexes.length) % hitIndexes.length)} disabled={hitIndexes.length === 0}>＜</button>
            <span>{hitIndexes.length > 0 ? `${currentHit + 1} / ${hitIndexes.length}` : '該当なし'}</span>
            <button className={spotlightStyles.controlButton} onClick={() => setCurrentHit((h) => (h + 1) % hitIndexes.length)} disabled={hitIndexes.length === 0}>＞</button>
            <button className={spotlightStyles.closeButton} onClick={() => setShowSpotlight(false)}>閉じる</button>
          </div>
          {/* 検索結果リスト */}
          {search && hitIndexes.length > 0 && (
            <ul style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              background: '#fff',
              border: '1px solid #ccc',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              maxHeight: 260,
              overflowY: 'auto',
              margin: 0,
              padding: 0,
              zIndex: 101,
              listStyle: 'none',
            }}>
              {hitIndexes.map((idx, i) => (
                <li
                  key={limitedNodesState[idx]?.id || i}
                  style={{
                    padding: '8px 16px',
                    background: i === currentHit ? '#e3f2fd' : '#fff',
                    color: '#333',
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee',
                    fontWeight: i === currentHit ? 'bold' : 'normal',
                  }}
                  onMouseDown={e => {
                    setCurrentHit(i);
                    setShowSpotlight(false);
                    setFocusedNode(limitedNodesState[idx]);
                  }}
                >
                  {limitedNodesState[idx]?.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
  <svg ref={svgRef} style={{ position: 'absolute', top: isMobile ? 100 : 0, left: 0, zIndex: 1, width: '100vw', height: isMobile ? 'calc(100vh - 100px)' : '100vh' }}></svg>
      {/* --- ズーム・リセットボタン --- */}
  <div style={{ position: 'absolute', left: 20, bottom: 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          style={{ width: 40, height: 40, borderRadius: 8, fontSize: 24, background: '#fff', border: '1px solid #ccc', cursor: 'pointer', marginBottom: 2 }}
          onClick={() => {
            if (svgRef.current && zoomRef.current) {
              d3.select(svgRef.current as unknown as Element).transition().duration(200).call((zoomRef.current as any).scaleBy, 1.2);
            }
          }}
          aria-label="拡大"
        >＋</button>
        <button
          style={{ width: 40, height: 40, borderRadius: 8, fontSize: 24, background: '#fff', border: '1px solid #ccc', cursor: 'pointer', marginBottom: 2 }}
          onClick={() => {
            if (svgRef.current && zoomRef.current) {
              d3.select(svgRef.current as unknown as Element).transition().duration(200).call((zoomRef.current as any).scaleBy, 1/1.2);
            }
          }}
          aria-label="縮小"
        >－</button>
        <button
          style={{ width: 40, height: 40, borderRadius: 8, fontSize: 20, background: '#fff', border: '1px solid #ccc', cursor: 'pointer' }}
          onClick={() => {
            if (svgRef.current && zoomRef.current) {
              // 注目ノード(node=...)があればその座標を画面中央に
              const svg = svgRef.current as unknown as Element;
              const w = window.innerWidth;
              const h = isMobile ? window.innerHeight - 120 : window.innerHeight;
              let targetNode = null;
              if (limitedNodesState && limitedNodesState.length > 0 && nodeId) {
                targetNode = limitedNodesState.find(n => n.id === nodeId);
              }
              if (targetNode && typeof targetNode.x === 'number' && typeof targetNode.y === 'number') {
                // ノード座標(x, y)を画面中央(w/2, h/2)に合わせる
                const scale = 1; // 必要なら拡大率も調整可
                const tx = w / 2 - targetNode.x * scale;
                const ty = h / 2 - targetNode.y * scale;
                d3.select(svg).transition().duration(400).call(
                  (zoomRef.current as any).transform,
                  d3.zoomIdentity.translate(tx, ty).scale(scale)
                );
              } else {
                // ノードが見つからなければ従来通りSVG中央
                d3.select(svg).transition().duration(300).call(
                  (zoomRef.current as any).transform,
                  d3.zoomIdentity.translate(0, isMobile ? 0 : 0).scale(1)
                );
              }
            }
          }}
          aria-label="中心に戻る"
        >⦿</button>
      </div>
      {focusedNode && (
        <div style={isMobile ? {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #ccc',
          borderRadius: '12px 12px 0 0',
          padding: '16px',
          zIndex: 102,
          maxHeight: '60vh',
          overflowY: 'auto',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.1)'
        } : {
          position: 'absolute',
          top: 60,
          right: 20,
          zIndex: 3,
          background: '#fff',
          border: '1px solid #ccc',
          padding: '10px',
          minWidth: 320,
          maxWidth: 400,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20 }}>フォーカス中のノード: {focusedNode.name}</h2>
            {isMobile && (
              <button
                onClick={() => setFocusedNode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  padding: 4,
                  color: '#666'
                }}
              >×</button>
            )}
          </div>
          {/* 事業ノードのときはproject_idがなくてもレビューシートURL欄を必ず表示 */}
          {focusedNode.group === 'project_name' && (
            <div style={{ margin: '8px 0' }}>
              {String(focusedNode.project_id || '').length > 0 ? (
                <a
                  href={`https://rssystem.go.jp/project?projectNumbers=${focusedNode.project_id}&fiscalYear=2024`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1976d2', textDecoration: 'underline', fontWeight: 'bold' }}
                >
                  レビューシートを見る（project_id: {focusedNode.project_id}）
                </a>
              ) : (
                <span style={{ color: '#888' }}>レビューシートURL（project_id未設定）</span>
              )}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            {/* 予算額 */}
            <div style={{ marginBottom: 8 }}>
              <strong>予算額:</strong> {focusedNode.initial_budget ? `${Number(focusedNode.initial_budget).toLocaleString()}円` : 'データなし'}
            </div>
            {/* 支払先企業一覧 */}
            <div>
              <strong>支払先企業一覧:</strong>
              <ul style={{ margin: '6px 0 0 0', padding: 0, listStyle: 'none', maxHeight: isMobile ? 150 : 120, overflowY: 'auto', fontSize: isMobile ? 13 : 14 }}>
                {(focusedNode.spending_list && focusedNode.spending_list.length > 0) ? (
                  focusedNode.spending_list.map((sp: SpendingItem, idx: number) => (
                    <li key={idx} style={{ borderBottom: '1px solid #eee', padding: '2px 0' }}>
                      {sp.recipient_name || '(名称不明)'}
                      {sp.corporate_number ? `（法人番号: ${sp.corporate_number}）` : ''}
                      {sp.amount ? ` 金額: ${Number(sp.amount).toLocaleString()}円` : ''}
                      {sp.block_name ? ` [${sp.block_name}]` : ''}
                    </li>
                  ))
                ) : (
                  <li style={{ color: '#888' }}>支払先データなし</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const SubgraphPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SubgraphContent />
    </Suspense>
  );
};

export default SubgraphPage;
