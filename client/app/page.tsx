
"use client";

import React, { useEffect, useRef, useState } from 'react';


import Fuse from 'fuse.js';
// ノード座標キャッシュ
const nodePositionCache: { [id: string]: { x: number, y: number } } = {};
import * as d3 from 'd3';
// より区別しやすいカラーマップ（HCL色空間ベース）
function getDistinctColorMap(keys: string[]): Record<string, string> {
  // d3.interpolateRainbowで色相を分散し、彩度・明度も調整
  // HCL色空間で彩度・明度を高めに
  const n = keys.length;
  const colorMap: Record<string, string> = {};
  for (let i = 0; i < n; i++) {
    // d3.interpolateRainbowは0〜1で色相を一周
    const t = i / n;
    // d3.hclで彩度・明度を強調
    const hue = 360 * t;
    // 80:高彩度, 65:高明度, 1:最大彩度
    colorMap[keys[i]] = d3.hcl(hue, 80, 65).toString();
  }
  return colorMap;
}
import styles from '../src/app/SpotlightSearch.module.css'; // Import the CSS module

// 階層名リスト（最上位は動的に決定）
export const hierarchyNames = [
  'bureau_agency', // 局・庁
  'department',    // 部
  'division',      // 課
  'office',        // 係
  'section',       // 班
  'group',         // 室
  'team',          // （なければスキップ）
  'project_name'   // 事業名
];

// 階層名ごとに明確なサイズ差をつける
export const nodeSizeByGroup: Record<string, number> = {
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
  unknown: 4
};

interface BudgetItem {
  project_id: number;
  fiscal_year: number;
  business_year: number;
  project_name: string;
  main_reason_for_change: string;
  other_notes: string;
  initial_budget_total: number;
  supplementary_budget_total: number;
  carried_over_from_previous_year_total: number;
  reserve_etc_total: number;
  execution_amount_total: number;
  carried_over_to_next_year_total: number;
  next_year_request_total: number;
  organization_id: number;
  bureau_agency: string;
  department: string;
  division: string;
  office: string;
  group: string;
  section: string;
  ministry_name: string;
  ministry_order: number;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  yomi?: string; // ひらがな
  group: string; // e.g., policy, ministry, bureau, etc.
  value: number; // for edge width
  url?: string; // for popup
  initial_budget?: number; // for popup
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  value: number; // for edge width
  source: Node; // Ensure source is of type Node
  target: Node; // Ensure target is of type Node
}

const ForceDirectedGraph: React.FC = () => {
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform | null>(null);
  const [data, setData] = useState<BudgetItem[]>([]);
  // 省庁ごとの表示・非表示制御
  const [visibleAgencies, setVisibleAgencies] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  // Spotlight風検索UI
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [search, setSearch] = useState('');
  const [hitIndexes, setHitIndexes] = useState<number[]>([]); // limitedNodesのindex
  const [currentHit, setCurrentHit] = useState(0);
  const [limitedNodesState, setLimitedNodesState] = useState<Node[]>([]); // limitedNodesを保持
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
      threshold: 0.4, // 0:完全一致, 1:全件ヒット。0.3〜0.5が推奨
      minMatchCharLength: 1,
      ignoreLocation: true,
      useExtendedSearch: true,
    });
    const results = fuse.search(search);
    const hits = results.map(res => limitedNodesState.findIndex(n => n.id === res.item.id));
    setHitIndexes(hits);
    setCurrentHit(0);
  }, [search, limitedNodesState]);

  // Spotlightで選択中のノードを拡大・中央フォーカス
  useEffect(() => {
    if (!showSpotlight || hitIndexes.length === 0 || !svgRef.current || !limitedNodesState.length) return;
    const idx = hitIndexes[currentHit];
    const node = limitedNodesState[idx];
    if (!node) return;
    const svg = d3.select(svgRef.current);
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    // ズームアニメーション
    if (zoomRef.current) {
      // ノードの座標(x, y)を画面中心(window.innerWidth/2, window.innerHeight/2)に移動するズーム変換
      const scale = 1.8;
      const tx = window.innerWidth / 2 - x * scale;
      const ty = window.innerHeight / 2 - y * scale;
      svg.transition().duration(400).call((zoomRef.current as any).transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
    // ノード・リンクのハイライト
    svg.selectAll('.node-group').select('circle')
      .attr('stroke', (d: any) => d.id === node.id ? '#e17055' : '#fff')
      .attr('stroke-width', (d: any) => d.id === node.id ? 6 : 1.5)
      .attr('r', (d: any) => d.id === node.id ? 1.5 * ((d as Node).group ? (nodeSizeByGroup[(d as Node).group] ?? 8) : 8) : ((d as Node).group ? (nodeSizeByGroup[(d as Node).group] ?? 8) : 8))
      .attr('opacity', (d: any) => d.id === node.id ? 1 : 0.15);
    svg.selectAll('.node-group').select('text')
      .attr('opacity', (d: any) => d.id === node.id ? 1 : 0.15);
    svg.selectAll('.links line')
      .attr('opacity', (l: any) => (l.source.id === node.id || l.target.id === node.id) ? 1 : 0.07);
    // 1秒後に元に戻す
    setTimeout(() => {
      svg.selectAll('.node-group').select('circle')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('r', (d: any) => (d as Node).group ? (nodeSizeByGroup[(d as Node).group] ?? 8) : 8)
        .attr('opacity', 1);
      svg.selectAll('.node-group').select('text')
        .attr('opacity', 1);
      svg.selectAll('.links line')
        .attr('opacity', 0.6);
    }, 1000);
  }, [currentHit, hitIndexes, showSpotlight, limitedNodesState]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result: BudgetItem[] = await response.json();
  setData(result);
  console.log('取得データ件数:', result.length);
  // 省庁一覧を初期化
  // agency_name と ministry_name の両方を重複なく列挙
  const agencyNames = result.map(item => (item as any).agency_name).filter(Boolean);
  const ministryNames = result.map(item => (item as any).ministry_name).filter(Boolean);
  const agencies = Array.from(new Set([...agencyNames, ...ministryNames])).filter(Boolean);
  setVisibleAgencies(agencies);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    // 画面全体サイズ取得
    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('width', '100vw')
      .style('height', '100vh')
      .html(''); // Clear previous content

    // ズーム用gラッパー
    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');
    const linkGroup = zoomLayer.append('g').attr('class', 'links');
    const nodeGroup = zoomLayer.append('g').attr('class', 'nodes');
    // --- D3ズーム機能 ---
    // 全ノードが俯瞰できる最小ズームを計算
    const minZoom = 0.1;
    const maxZoom = 4;
    const initialZoom = 1;
    const center = [width / 2, height / 2];

    const zoomed = (event: d3.D3ZoomEvent<Element, unknown>) => {
      zoomLayer.attr('transform', event.transform.toString());
      setZoomTransform(event.transform);
    };
    const zoom = d3.zoom<Element, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .on('zoom', zoomed);
    zoomRef.current = zoom;
  svg.call(zoom as any);
  // 初期位置リセット
  svg.call((zoom as any).transform, d3.zoomIdentity.translate(0, 0).scale(initialZoom));
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
  .style('background-color', '#fff')
  .style('border', '1px solid #ccc')
  .style('border-radius', '8px')
  .style('padding', '10px 15px')
  .style('z-index', 1001)
  .style('pointer-events', 'none');

    // メインページは「政策所管府省庁→府省庁→局・庁→部→課→室→班→係」までを描画
    // 事業名(project_name)は除外
    const hierarchyNames = [
      'bureau_agency', // 局・庁
      'department',    // 部
      'division',      // 課
      'office',        // 係
      'section',       // 班
      'group',         // 室
      'team'           // （なければスキップ）
      // 'project_name'   // 事業名はサブグラフのみ
    ];

    // 階層名ごとに明確なサイズ差をつける
    const nodeSizeByGroup: Record<string, number> = {
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
      unknown: 4
    };

    // ノード・リンク生成
    const nodes: Node[] = [];
    const nodeMap = new Map<string, Node>();
    const aggregatedBudgets = new Map<string, number>();
    const aggregatedLinkBudgets = new Map<string, Map<string, number>>();

    // --- 省庁ごとに扇形を割り当て、ノード初期配置を円グラフ風に ---
    // 省庁リスト
    const agencyList = visibleAgencies;
    const agencyAngles: Record<string, {start: number, end: number}> = {};
    const totalAgencies = agencyList.length;
    agencyList.forEach((agency, i) => {
      const start = (2 * Math.PI * i) / totalAgencies;
      const end = (2 * Math.PI * (i + 1)) / totalAgencies;
      agencyAngles[agency] = { start, end };
    });

    // ノード生成
  data.forEach(item => {
    let topLevel = (item as any)['agency_name'];
    let topLevelKey = 'agency_name';
    if (!topLevel || topLevel === '' || topLevel === null || topLevel === undefined) {
      topLevel = (item as any)['ministry_name'];
      topLevelKey = 'ministry_name';
    }
    // 表示対象の省庁のみ描画
    if (!visibleAgencies.includes(topLevel)) return;
    const restHierarchy = hierarchyNames.map(key => (item as any)[key]).filter(Boolean);
    const restHierarchyYomi = hierarchyNames.map(key => (item as any)[key + '_yomi']).filter(Boolean);
    const hierarchy = [topLevel, ...restHierarchy].filter(Boolean);
    const hierarchyYomi = [(item as any)[topLevelKey + '_yomi'], ...restHierarchyYomi].filter(Boolean);
    let parentNodeId: string | null = null;
    let nodePath: string[] = [];
    let nodePathYomi: string[] = [];

    const currentBudget = Number(item.initial_budget_total) || 0;

    hierarchy.forEach((name, index) => {
      nodePath.push(name);
      nodePathYomi.push(hierarchyYomi[index] || '');
      const nodeId = nodePath.join('→');
      const nodeYomi = nodePathYomi.join('→');
      const groupName = index === 0 ? topLevelKey : hierarchyNames[index - 1] || 'unknown';

      if (!nodeMap.has(nodeId)) {
        // --- 位置キャッシュがあれば再利用、なければ円グラフ風初期配置 ---
        let x, y;
        if (nodePositionCache[nodeId]) {
          x = nodePositionCache[nodeId].x;
          y = nodePositionCache[nodeId].y;
        } else if (index === 0 && agencyAngles[topLevel]) {
          const angle = (agencyAngles[topLevel].start + agencyAngles[topLevel].end) / 2;
          const r = 260;
          x = width / 2 + Math.cos(angle) * r;
          y = height / 2 + Math.sin(angle) * r;
        } else if (agencyAngles[topLevel]) {
          const {start, end} = agencyAngles[topLevel];
          const angle = start + Math.random() * (end - start);
          const r = 320 + index * 60 + Math.random() * 30;
          x = width / 2 + Math.cos(angle) * r;
          y = height / 2 + Math.sin(angle) * r;
        }
        const newNode: Node = {
          id: nodeId,
          name: name,
          yomi: nodeYomi,
          group: groupName,
          value: 0, // Initialize to 0, will be aggregated
          initial_budget: 0, // Initialize to 0, will be aggregated
          url: '#',
          ...(x !== undefined && y !== undefined ? {x, y} : {})
        };
        nodes.push(newNode);
        nodeMap.set(nodeId, newNode);
      }

        // Aggregate budget for the current node
        aggregatedBudgets.set(nodeId, (aggregatedBudgets.get(nodeId) || 0) + currentBudget);

        if (parentNodeId) {
          const sourceNode = nodeMap.get(parentNodeId);
          const targetNode = nodeMap.get(nodeId);

          if (sourceNode && targetNode) {
            // Aggregate budget for the link
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

    // After processing all items, update node and link values
    nodes.forEach(node => {
      node.value = aggregatedBudgets.get(node.id) || 0;
      node.initial_budget = aggregatedBudgets.get(node.id) || 0;
      // 現在のノード位置をキャッシュ
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        nodePositionCache[node.id] = { x: node.x, y: node.y };
      }
    });

    // Create links from aggregatedLinkBudgets
    const links: Link[] = [];
    aggregatedLinkBudgets.forEach((targetMap, sourceId) => {
      targetMap.forEach((budget, targetId) => {
        const sourceNode = nodeMap.get(sourceId);
        const targetNode = nodeMap.get(targetId);
        if (sourceNode && targetNode) {
          links.push({
            source: sourceNode,
            target: targetNode,
            value: budget,
          });
        }
      });
    });

      let limitedNodes: Node[] = [];
      let limitedLinks: Link[] = [];
      if (visibleAgencies.length > 0) {
        limitedNodes = nodes.filter(node => {
          // 最上位ノード名がvisibleAgenciesに含まれるもののみ
          const topLevel = node.id.split('→')[0];
          return visibleAgencies.includes(topLevel);
        }).slice(0, 500);
        // 表示ノードに紐づくリンクのみ
        limitedLinks = links.filter(link =>
          limitedNodes.some(node => node.id === (link.source as Node).id) &&
          limitedNodes.some(node => node.id === (link.target as Node).id)
        );
      }
      setLimitedNodesState(limitedNodes); // 検索用に保持

    // 階層ごとにノードを分類
    const nodeLevels = new Map<Node, number>();
    limitedNodes.forEach(node => {
      // idの"→"区切り数で階層を判定
      const level = node.id.split('→').length - 1;
      nodeLevels.set(node, level);
    });

    // 各階層ごとに異なる半径を割り当てる
    const minRadius = 120;
    const radiusStep = 120;
    const maxLevel = Math.max(...Array.from(nodeLevels.values()));

    // forceRadialと力学パラメータ調整
    const simulation = d3.forceSimulation<Node, Link>(limitedNodes)
      .force('link', d3.forceLink<Node, Link>(limitedLinks).id(d => d.id as string).distance(180))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(d => (nodeSizeByGroup[(d as Node).group] ?? 4) + 2))
      .force('radial', d3.forceRadial<Node>(d => minRadius + nodeLevels.get(d)! * radiusStep, width / 2, height / 2).strength(1));

    // エッジの太さの最小値と最大値を定義
    const minEdgeWidth = 1.5;
    const maxEdgeWidth = 30;

    // リンクの予算額の最小値と最大値を計算
    const minLinkValue = d3.min(limitedLinks, d => d.value) || 0;
    const maxLinkValue = d3.max(limitedLinks, d => d.value) || 1; // 0除算を避けるため最低1

    // 予算額をエッジの太さにマッピングするスケール関数
    const edgeWidthScale = d3.scaleLinear()
      .domain([minLinkValue, maxLinkValue])
      .range([minEdgeWidth, maxEdgeWidth]);

    const link = linkGroup
      .selectAll('line')
      .data(limitedLinks)
      .join('line')
      .attr('stroke-width', d => edgeWidthScale(d.value))
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6);

    // Create a group for each node (ellipse + text)
    const nodeEnter = nodeGroup
      .selectAll<SVGGElement, Node>('g')
      .data(limitedNodes)
      .join('g')
      .attr('class', 'node-group')
      .call(d3.drag<SVGGElement, Node, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));


    // 階層ごとにノードサイズを調整
  // （上部で定義済みのためここは削除）
    // カスタムカラーパレットを定義 (階層レベルに応じて色相を調整)

  // 最上位ノード（省庁名 or agency_name）一覧を抽出し、色被りしないカラーマップを生成
  const topLevelKeys = Array.from(new Set(nodes.map(n => n.id.split('→')[0])));
  const colorMap = getDistinctColorMap(topLevelKeys);

  // 省庁ごとに特徴的なSVGアイコンを割り当て
  const ministryIconPaths: Record<string, string> = {
    '防衛省': 'M12 2L2 7v6c0 5.55 3.84 10.74 10 13 6.16-2.26 10-7.45 10-13V7l-10-5zm0 2.18l7.5 3.75v5.57c0 4.73-3.18 9.13-7.5 11.05-4.32-1.92-7.5-6.32-7.5-11.05V7.93L12 4.18z', // 盾
    '文部科学省': 'M12 2C7.03 2 2.73 5.11 2.73 9.09c0 2.13 1.41 4.06 3.77 5.36L6 22l6-2 6 2-0.5-7.55c2.36-1.3 3.77-3.23 3.77-5.36C21.27 5.11 16.97 2 12 2zm0 2c4.08 0 7.27 2.36 7.27 5.09 0 1.44-1.13 2.89-3.13 3.97l-0.61.33L18 20l-6-2-6 2 1.47-9.61-0.61-.33C4.86 10.98 3.73 9.53 3.73 8.09 3.73 6.36 7.92 4 12 4z', // アカデミックハット
    '環境省': 'M12 2C8.13 2 5 5.13 5 9c0 3.87 7 13 7 13s7-9.13 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', // 森（木）
    '厚生労働省': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z', // 十字（医療）
    '国土交通省': 'M12 2L2 7v6c0 5.55 3.84 10.74 10 13 6.16-2.26 10-7.45 10-13V7l-10-5zm0 2.18l7.5 3.75v5.57c0 4.73-3.18 9.13-7.5 11.05-4.32-1.92-7.5-6.32-7.5-11.05V7.93L12 4.18z', // 盾（仮）
    '総務省': 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 17.93c-2.83.48-5.48-1.51-5.96-4.34-.09-.52.36-.99.89-.99.45 0 .83.3.93.73.34 1.5 1.72 2.57 3.24 2.57 1.52 0 2.9-1.07 3.24-2.57.1-.43.48-.73.93-.73.53 0 .98.47.89.99-.48 2.83-3.13 4.82-5.96 4.34z', // 円
    '財務省': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-2.83.48-5.48-1.51-5.96-4.34-.09-.52.36-.99.89-.99.45 0 .83.3.93.73.34 1.5 1.72 2.57 3.24 2.57 1.52 0 2.9-1.07 3.24-2.57.1-.43.48-.73.93-.73.53 0 .98.47.89.99-.48 2.83-3.13 4.82-5.96 4.34z', // 円
    '農林水産省': 'M12 2C8.13 2 5 5.13 5 9c0 3.87 7 13 7 13s7-9.13 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', // 木
    '経済産業省': 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 8h2v-2H7v2zm0-4h2v-2H7v2zm0-4h2V7H7v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2z', // グリッド
    '法務省': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z', // 円
    '外務省': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z', // 円
    '内閣府': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z', // 円
    '警察庁': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z', // 円
    '復興庁': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z', // 円
  };
  const iconPaths: Record<string, string> = {
    ...ministryIconPaths,
    ministry_name: 'M4 20h16v-2H4v2zm1-4h14V8l-7-5-7 5v8z', // 省庁: 建物（デフォルト）
    bureau_agency: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 8h2v-2H7v2zm0-4h2v-2H7v2zm0-4h2V7H7v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2z', // 局: グリッド
    department: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', // 部: 家
    division: 'M12 7V3H2v18h20V7H12zm0 2h8v10H4V5h8v4z', // 課: フォルダ
    office: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z', // 係: 四角
    section: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2z', // 班: 小グリッド
    group: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', // 室: 人
    team: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C17 13.17 12.33 12 10 12zm8 0c-.29 0-.62.02-.97.05C17.64 13.1 19 14.28 19 15.5V19h4v-2.5c0-2.33-4.67-3.5-7-3.5z', // チーム: 複数人
    project_name: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z', // 事業: 四角
    unknown: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-2.83.48-5.48-1.51-5.96-4.34-.09-.52.36-.99.89-.99.45 0 .83.3.93.73.34 1.5 1.72 2.57 3.24 2.57 1.52 0 2.9-1.07 3.24-2.57.1-.43.48-.73.93-.73.53 0 .98.47.89.99-.48 2.83-3.13 4.82-5.96 4.34z', // ?
  };

  // まず全ノードに円を描画
  nodeEnter.append('circle')
    .attr('r', d => nodeSizeByGroup[d.group] ?? 8)
    .attr('fill', d => {
      const topLevelId = d.id.split('→')[0];
      return colorMap[topLevelId] || '#1976d2';
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5);

  // 政策所管府省庁（agency_name）は円の中に省庁名テキストを白色で中央表示
  // 省庁名テキストが円からはみ出さないようピクセル幅で省略
  function getTextWidth(text: string, fontSize: number, fontFamily = 'Arial, sans-serif'): number {
    if (!text) return 0;
  const canvas = ((getTextWidth as any) as any)._canvas || (((getTextWidth as any) as any)._canvas = document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    ctx.font = `${fontSize}px ${fontFamily}`;
    return ctx.measureText(text).width;
  }
  nodeEnter.filter(d => d.group === 'agency_name')
    .append('text')
    .text(d => {
      const r = nodeSizeByGroup[d.group] ?? 8;
      const maxWidth = r * 2 * 0.85;
      if (!d.name) return '';
      const fontSize = Math.max(8, Math.min(r * 0.6, (r * 2 * 0.85) / (d.name.length * 0.65)));
      // できるだけ多くの文字を…なしで表示し、超えた場合のみ…を付与
      // 4文字以下は必ず全て表示
      if (d.name.length <= 4) {
        return d.name;
      }
      // 5文字以上は収まる最大文字数まで…なしで表示、超えた場合のみ…
      let maxFit = 0;
      for (let i = 1; i <= d.name.length; i++) {
        const testStr = d.name.slice(0, i);
        if (getTextWidth(testStr, fontSize) > maxWidth) {
          break;
        }
        maxFit = i;
      }
      if (maxFit === d.name.length) {
        return d.name; // 全部収まる
      } else if (maxFit > 1) {
        return d.name.slice(0, maxFit) + '…';
      } else {
        // 1文字しか収まらない場合は1文字＋…
        return d.name.slice(0, 1) + '…';
      }
    })
    .attr('font-size', d => {
      const r = nodeSizeByGroup[d.group] ?? 8;
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
    .attr('d', d => {
      // 省庁ノードなら省庁名で分岐、それ以外は従来通り
      if (d.group === 'ministry_name' && ministryIconPaths[d.name]) return ministryIconPaths[d.name];
      return iconPaths[d.group] || iconPaths['unknown'];
    })
    .attr('fill', '#fff')
    .attr('stroke', 'none')
    .attr('transform', d => {
      const r = nodeSizeByGroup[d.group] ?? 8;
      return `scale(${r/12*0.7}) translate(-12,-12)`;
    });


    nodeEnter.append('title')
      .text(d => d.name);

    nodeEnter
      .on('mouseover', (event, d) => {
        setFocusedNode(d);
        // --- ハイライト処理 ---
        const connectedIds = new Set([d.id]);
        links.forEach(l => {
          if (l.source.id === d.id) connectedIds.add(l.target.id);
          if (l.target.id === d.id) connectedIds.add(l.source.id);
        });
        // 円の色を変更（非フォーカスは灰色）
        nodeEnter.select('circle')
          .attr('fill', n => connectedIds.has(n.id) ? (colorMap[n.id.split('→')[0]] || '#1976d2') : '#ccc');
        // アイコン（path）は非フォーカスを薄いグレーに
        nodeEnter.select('path')
          .attr('fill', n => connectedIds.has(n.id) ? '#fff' : '#eee');
        link.attr('opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.07);
        // --- ツールチップ ---
        tooltip.style('pointer-events', 'all');
        tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        tooltip.html(`
          <strong>${d.name}</strong><br/>
          予算額: ${d.initial_budget?.toLocaleString()}円<br/>
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
        setFocusedNode(null);
        nodeEnter.select('circle')
          .attr('fill', n => {
            const topLevelId = n.id.split('→')[0];
            return colorMap[topLevelId] || '#1976d2';
          });
        nodeEnter.select('path')
          .attr('fill', '#fff');
        link.attr('opacity', 0.6);
        tooltip.transition()
          .duration(500)
          .style('opacity', 0)
          .on('end', function() { d3.select(this).style('pointer-events', 'none'); });
      })
      .on('click', (event, d) => {
        if (isMobile) {
          // モバイルでは詳細表示
          setSelectedNode(d);
          event.stopPropagation();
        } else {
          // PCではサブグラフページへ遷移
          window.location.href = `/subgraph?node=${encodeURIComponent(d.id)}`;
          event.stopPropagation();
        }
      });

    // ハイライトをクリアする関数
    const clearHighlights = () => {
      setFocusedNode(null);
      nodeEnter.attr('opacity', 1);
      link.attr('opacity', 0.6);
    };

    // SVG背景をクリックした際にハイライトをクリア
    svg.on('click', () => {
      clearHighlights();
      setSelectedNode(null);
    });

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!);

      nodeEnter // Update position for the group
        .attr('transform', d => `translate(${d.x!},${d.y!})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, Node, Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Cleanup tooltip on component unmount
    return () => {
      tooltip.remove();
      svg.on('.zoom', null); // ズームイベント解除
    };

  }, [data, visibleAgencies]);

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
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: '#07796b',
                animation: `pulse 1.5s infinite ${i * 0.2}s`
              }}
            />
          ))}
        </div>
        
        <p style={{
          fontSize: 16,
          color: '#64748b',
          margin: 0,
          textAlign: 'center'
        }}>データを読み込んでいます...</p>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.3);
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
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{
          fontSize: 20,
          fontWeight: 600,
          color: '#dc2626',
          margin: 0
        }}>エラーが発生しました</h2>
        <p style={{
          fontSize: 14,
          color: '#64748b',
          margin: 0,
          textAlign: 'center'
        }}>{error}</p>
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
        >再読み込み</button>
      </div>
    </div>
  );

  return (
    <div style={{ width: '100vw', height: isMobile ? '100dvh' : '100vh', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>
      {/* タイトル・検索ボタンのレイアウト */}
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
          gap: 6,
          padding: '8px 0 2px 0',
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
        <h1 style={{ margin: 0, fontSize: isMobile ? 17 : 24, flex: 'none', color: '#333', background: 'rgba(255,255,255,0.8)' }}>ZAIMYAKU</h1>
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
          style={isMobile ? {
            marginTop: 2,
            background: '#07796b',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '6px 16px',
            fontSize: 15,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            alignSelf: 'center',
          } : {
            marginLeft: 24,
            background: '#07796b',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 18,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: 'pointer',
          }}
          onClick={() => window.location.href = '/landing'}
          aria-label="サービス紹介ページを開く"
        >サービス紹介</button>
      </div>
      {/* 省庁ごとの表示・非表示コントロール */}
      <div style={isMobile ? {
        position: 'absolute',
        bottom: 10,
        right: 10,
        zIndex: 30,
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 6,
        padding: '6px 6px',
        maxHeight: '30vh',
        overflowY: 'auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        fontSize: 13,
        minWidth: 90
      } : {
        position: 'absolute',
        bottom: 30,
        right: 40,
        zIndex: 30,
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 6,
        padding: '6px 10px',
        maxHeight: '50vh',
        overflowY: 'auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        fontSize: 14,
        minWidth: 120
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: isMobile ? 13 : 14 }}>省庁表示切替</div>
        {Array.from(new Set(data.map(item => (item as any).agency_name).filter(Boolean))).map(agency => (
          <label key={agency} style={{ display: 'block', marginBottom: 2, fontSize: isMobile ? 13 : 14 }}>
            <input
              type="checkbox"
              checked={visibleAgencies.includes(agency)}
              onChange={e => {
                if (e.target.checked) {
                  setVisibleAgencies(prev => [...prev, agency]);
                } else {
                  setVisibleAgencies(prev => prev.filter(a => a !== agency));
                }
              }}
              style={{ marginRight: 4 }}
            />
            {agency}
          </label>
        ))}
      </div>
      {/* フォーカス中のノード表示 */}
      {focusedNode && (
        <div style={isMobile ? {
          position: 'absolute',
          top: 60,
          left: 10,
          zIndex: 31,
          background: '#fff',
          border: '1px solid #ccc',
          padding: '6px 8px',
          minWidth: 160,
          maxWidth: 220,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          fontSize: 13
        } : {
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 31,
          background: '#fff',
          border: '1px solid #ccc',
          padding: '6px 12px',
          minWidth: 220,
          maxWidth: 320,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          fontSize: 15
        }}>
          <div><strong>フォーカス中のノード:</strong> {focusedNode.name}</div>
          <div style={{ marginTop: 4, color: '#444' }}>予算額: {focusedNode.initial_budget ? Number(focusedNode.initial_budget).toLocaleString() + '円' : 'データなし'}</div>
        </div>
      )}
      {/* 選択されたノードの詳細表示（モバイル用） */}
      {selectedNode && isMobile && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #ccc',
          borderRadius: '12px 12px 0 0',
          padding: '16px',
          zIndex: 102,
          maxHeight: '50vh',
          overflowY: 'auto',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#333' }}>{selectedNode.name}</h3>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                padding: 4,
                color: '#666'
              }}
            >×</button>
          </div>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
            階層: {selectedNode.group === 'agency_name' ? '政策所管府省庁' : 
                  selectedNode.group === 'ministry_name' ? '省庁' :
                  selectedNode.group === 'bureau_agency' ? '局・庁' :
                  selectedNode.group === 'department' ? '部' :
                  selectedNode.group === 'division' ? '課' :
                  selectedNode.group === 'office' ? '係' :
                  selectedNode.group === 'section' ? '班' :
                  selectedNode.group === 'group' ? '室' :
                  selectedNode.group === 'team' ? 'チーム' : selectedNode.group}
          </div>
          <div style={{ fontSize: 14, color: '#333', marginBottom: 12 }}>
            予算額: {selectedNode.initial_budget ? Number(selectedNode.initial_budget).toLocaleString() + '円' : 'データなし'}
          </div>
          <button
            onClick={() => window.location.href = `/subgraph?node=${encodeURIComponent(selectedNode.id)}`}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 14,
              cursor: 'pointer',
              width: '100%'
            }}
          >サブグラフで詳細を見る</button>
        </div>
      )}
      {/* --- Spotlight風検索UI --- */}
      {showSpotlight && (
        <div className={styles.spotlightContainer} style={{ position: 'absolute', top: isMobile ? 70 : 80, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <input
            autoFocus
            type="text"
            placeholder="ノード名で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <div className={styles.controls}>
            <button className={styles.controlButton} onClick={() => setCurrentHit((h) => (h - 1 + hitIndexes.length) % hitIndexes.length)} disabled={hitIndexes.length === 0}>＜</button>
            <span>{hitIndexes.length > 0 ? `${currentHit + 1} / ${hitIndexes.length}` : '該当なし'}</span>
            <button className={styles.controlButton} onClick={() => setCurrentHit((h) => (h + 1) % hitIndexes.length)} disabled={hitIndexes.length === 0}>＞</button>
            <button className={styles.closeButton} onClick={() => setShowSpotlight(false)}>閉じる</button>
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
                    // ノードを中央にズーム（既存useEffectで自動）
                  }}
                >
                  {limitedNodesState[idx]?.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
  <svg ref={svgRef} style={{ position: 'absolute', top: isMobile ? 56 : 0, left: 0, zIndex: 1, width: '100vw', height: isMobile ? 'calc(100vh - 56px)' : '100vh' }}></svg>
      {/* --- ズーム・リセットボタン --- */}
  <div style={{ position: 'absolute', left: isMobile ? 10 : 20, bottom: isMobile ? 10 : 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              d3.select(svgRef.current as unknown as Element).transition().duration(300).call((zoomRef.current as any).transform, d3.zoomIdentity.translate(0, 0).scale(1));
            }
          }}
          aria-label="中心に戻る"
        >⦿</button>
      </div>
  {/* 右上の古いフォーカス中のノード表示を削除 */}
    </div>
  );
};

export default ForceDirectedGraph;
