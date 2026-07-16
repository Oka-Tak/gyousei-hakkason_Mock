"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import * as d3 from 'd3';
import type { GraphLinkDatum, GraphNodeDatum } from '@/features/graph/types';
import { formatJaYen } from '@/utils/format';

type NodeSizeMap = Record<string, number>;

export interface ForceGraphHandle {
  zoomBy: (factor: number) => void;
  resetZoom: () => void;
}

export interface ForceGraphProps {
  nodes: GraphNodeDatum[];
  links: GraphLinkDatum[];
  colorMap: Record<string, string>;
  nodeSizeByGroup: NodeSizeMap;
  isMobile?: boolean;
  width?: number;
  height?: number;
  linkDistance?: number;
  chargeStrength?: number;
  focusedNodeId?: string | null;
  highlightNodeIds?: readonly string[];
  highlightEdges?: ReadonlyArray<{ sourceId: string; targetId: string }>;
  onNodeClick?: (node: GraphNodeDatum, event: MouseEvent) => void;
  onBackgroundClick?: () => void;
  svgStyle?: React.CSSProperties;
  showTopLevelLabels?: boolean;
}

type LinkSelection = d3.Selection<SVGLineElement, GraphLinkDatum, SVGGElement, unknown>;
type NodeSelection = d3.Selection<SVGGElement, GraphNodeDatum, SVGGElement, unknown>;

type RenderState = {
  links: LinkSelection;
  nodes: NodeSelection;
  nodeById: Map<string, GraphNodeDatum>;
};

const EMPTY_NODE_IDS: readonly string[] = [];
const EMPTY_EDGES: ReadonlyArray<{ sourceId: string; targetId: string }> = [];
const ICON_RENDER_LIMIT = 250;
const INTERACTION_DURATION_MS = 160;

const ICON_PATHS: Record<string, string> = {
  ministry_name: 'M4 20h16v-2H4v2zm1-4h14V8l-7-5-7 5v8z',
  bureau_agency: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 8h2v-2H7v2zm0-4h2v-2H7v2zm0-4h2V7H7v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2z',
  department: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  division: 'M12 7V3H2v18h20V7H12zm0 2h8v10H4V5h8v4z',
  office: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
  section: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2z',
  group: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  team: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C17 13.17 12.33 12 10 12zm8 0c-.29 0-.62.02-.97.05C17.64 13.1 19 14.28 19 15.5V19h4v-2.5c0-2.33-4.67-3.5-7-3.5z',
  project_name: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
  unknown: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-2.83.48-5.48-1.51-5.96-4.34-.09-.52.36-.99.89-.99.45 0 .83.3.93.73.34 1.5 1.72 2.57 3.24 2.57 1.52 0 2.9-1.07 3.24-2.57.1-.43.48-.73.93-.73.53 0 .98.47.89.99-.48 2.83-3.13 4.82-5.96 4.34z',
};

function endpointId(endpoint: GraphNodeDatum | string | number): string {
  return typeof endpoint === 'object' ? endpoint.id : String(endpoint);
}

const ForceGraph = forwardRef<ForceGraphHandle, ForceGraphProps>(function ForceGraph({
  nodes,
  links,
  colorMap,
  nodeSizeByGroup,
  isMobile = false,
  width: widthProp,
  height: heightProp,
  linkDistance: linkDistanceProp,
  chargeStrength: chargeStrengthProp,
  focusedNodeId = null,
  highlightNodeIds = EMPTY_NODE_IDS,
  highlightEdges = EMPTY_EDGES,
  onNodeClick,
  onBackgroundClick,
  svgStyle,
  showTopLevelLabels = false,
}, ref) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const renderStateRef = useRef<RenderState | null>(null);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const onNodeClickRef = useRef(onNodeClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  onNodeClickRef.current = onNodeClick;
  onBackgroundClickRef.current = onBackgroundClick;

  const edgeWidthScale = useMemo(() => {
    const values = links.map((link) => link.value);
    const min = d3.min(values) ?? 0;
    const max = d3.max(values) ?? 1;
    return d3.scaleSqrt().domain([min, max]).range([1, 12]).clamp(true);
  }, [links]);

  useImperativeHandle(ref, () => ({
    zoomBy(factor: number) {
      const svgElement = svgRef.current;
      const zoom = zoomRef.current;
      if (!svgElement || !zoom) return;
      d3.select(svgElement)
        .interrupt()
        .transition()
        .duration(INTERACTION_DURATION_MS)
        .call(zoom.scaleBy, factor);
    },
    resetZoom() {
      const svgElement = svgRef.current;
      const zoom = zoomRef.current;
      if (!svgElement || !zoom) return;
      d3.select(svgElement)
        .interrupt()
        .transition()
        .duration(INTERACTION_DURATION_MS)
        .call(zoom.transform, d3.zoomIdentity);
    },
  }), []);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement || nodes.length === 0) return;

    const width = widthProp ?? window.innerWidth;
    const height = heightProp ?? (isMobile ? window.innerHeight - 56 : window.innerHeight);
    dimensionsRef.current = { width, height };

    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .style('width', widthProp ? `${width}px` : '100vw')
      .style('height', heightProp ? `${height}px` : (isMobile ? 'calc(100dvh - 56px)' : '100dvh'));
    svg.selectAll('*').remove();

    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');
    const linkGroup = zoomLayer.append('g').attr('class', 'links');
    const nodeGroup = zoomLayer.append('g').attr('class', 'nodes');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => zoomLayer.attr('transform', event.transform.toString()));
    zoomRef.current = zoom;
    svg.call(zoom).call(zoom.transform, d3.zoomIdentity);

    const simulation = d3.forceSimulation<GraphNodeDatum>(nodes)
      .alphaDecay(0.035)
      .alphaMin(0.01)
      .velocityDecay(0.45)
      .force('link', d3.forceLink<GraphNodeDatum, GraphLinkDatum>(links)
        .id((node) => node.id)
        .distance(linkDistanceProp ?? (isMobile ? 140 : 180)))
      .force('charge', d3.forceManyBody<GraphNodeDatum>()
        .strength(chargeStrengthProp ?? (isMobile ? -300 : -600))
        .distanceMax(Math.max(width, height) * 1.5))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNodeDatum>()
        .radius((node) => (nodeSizeByGroup[node.group] || 8) + 2))
      .force('radial', d3.forceRadial<GraphNodeDatum>(
        (node) => 120 + node.depth * 120,
        width / 2,
        height / 2,
      ).strength(1));

    const linkSelection = linkGroup.selectAll<SVGLineElement, GraphLinkDatum>('line')
      .data(links)
      .join('line')
      .attr('stroke-width', (link) => edgeWidthScale(link.value))
      .attr('stroke', '#999')
      .attr('opacity', 0.6);

    const nodeSelection = nodeGroup.selectAll<SVGGElement, GraphNodeDatum>('g')
      .data(nodes, (node) => node.id)
      .join('g')
      .attr('class', 'node-group')
      .call(d3.drag<SVGGElement, GraphNodeDatum>()
        .on('start', (event, node) => {
          if (!event.active) simulation.alphaTarget(0.2).restart();
          node.fx = node.x;
          node.fy = node.y;
        })
        .on('drag', (event, node) => {
          node.fx = event.x;
          node.fy = event.y;
        })
        .on('end', (event, node) => {
          if (!event.active) simulation.alphaTarget(0);
          node.fx = null;
          node.fy = null;
        }));

    nodeSelection.append('circle')
      .attr('r', (node) => nodeSizeByGroup[node.group] || 8)
      .attr('fill', (node) => colorMap[node.topLevel] || '#1976d2')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (event, node) => {
        event.stopPropagation();
        onNodeClickRef.current?.(node, event as MouseEvent);
      });

    if (nodes.length <= ICON_RENDER_LIMIT) {
      nodeSelection
        .filter((node) => node.group !== 'agency_name' && node.group !== 'ministry_name')
        .append('path')
        .attr('d', (node) => ICON_PATHS[node.group] || ICON_PATHS.unknown)
        .attr('fill', '#fff')
        .attr('pointer-events', 'none')
        .attr('transform', (node) => {
          const radius = nodeSizeByGroup[node.group] || 8;
          return `scale(${(radius / 12) * 0.7}) translate(-12,-12)`;
        });
    }

    if (showTopLevelLabels) {
      nodeSelection
        .filter((node) => node.depth === 0)
        .append('text')
        .attr('class', 'node-label')
        .text((node) => node.name)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#fff')
        .attr('font-weight', 700)
        .attr('font-size', (node) => {
          const radius = nodeSizeByGroup[node.group] || 8;
          return Math.max(isMobile ? 8 : 9, Math.min(isMobile ? 12 : 13, Math.round(radius * 0.5)));
        })
        .attr('paint-order', 'stroke')
        .attr('stroke', 'rgba(0,0,0,0.45)')
        .attr('stroke-width', 3)
        .attr('pointer-events', 'none');
    }

    nodeSelection.append('title').text((node) => `${node.name}\n${formatJaYen(node.value)}`);

    const renderPositions = () => {
      linkSelection
        .attr('x1', (link) => (link.source as GraphNodeDatum).x ?? 0)
        .attr('y1', (link) => (link.source as GraphNodeDatum).y ?? 0)
        .attr('x2', (link) => (link.target as GraphNodeDatum).x ?? 0)
        .attr('y2', (link) => (link.target as GraphNodeDatum).y ?? 0);
      nodeSelection.attr('transform', (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
    };

    renderStateRef.current = {
      links: linkSelection,
      nodes: nodeSelection,
      nodeById: new Map(nodes.map((node) => [node.id, node])),
    };
    simulation.on('tick', renderPositions);
    renderPositions();
    svg.on('click', () => onBackgroundClickRef.current?.());

    let visibilityObserver: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      simulation.stop();
      visibilityObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (simulation.alpha() > simulation.alphaMin()) simulation.restart();
        } else {
          simulation.stop();
        }
      });
      visibilityObserver.observe(svgElement);
    }

    return () => {
      visibilityObserver?.disconnect();
      simulation.stop();
      simulation.on('tick', null);
      svg.interrupt();
      svg.on('.zoom', null).on('click', null);
      svg.selectAll('*').interrupt().remove();
      renderStateRef.current = null;
      if (zoomRef.current === zoom) zoomRef.current = null;
    };
  }, [
    chargeStrengthProp,
    colorMap,
    edgeWidthScale,
    heightProp,
    isMobile,
    linkDistanceProp,
    links,
    nodeSizeByGroup,
    nodes,
    showTopLevelLabels,
    widthProp,
  ]);

  useEffect(() => {
    const svgElement = svgRef.current;
    const renderState = renderStateRef.current;
    if (!svgElement || !renderState) return;

    const { nodes: nodeSelection, links: linkSelection, nodeById } = renderState;
    nodeSelection
      .attr('opacity', 1)
      .select('circle')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('r', (node) => nodeSizeByGroup[node.group] || 8);
    linkSelection
      .attr('opacity', 0.6)
      .attr('stroke', '#999')
      .attr('stroke-width', (link) => edgeWidthScale(link.value));

    const hasHighlight = highlightNodeIds.length > 0 || highlightEdges.length > 0;
    if (hasHighlight) {
      const nodeIds = new Set(highlightNodeIds);
      const edgeIds = new Set<string>();
      highlightEdges.forEach(({ sourceId, targetId }) => {
        edgeIds.add(`${sourceId}→${targetId}`);
        edgeIds.add(`${targetId}→${sourceId}`);
      });

      nodeSelection
        .attr('opacity', (node) => nodeIds.size === 0 || nodeIds.has(node.id) ? 1 : 0.12)
        .select('circle')
        .attr('stroke', (node) => nodeIds.has(node.id) ? '#e17055' : '#fff')
        .attr('stroke-width', (node) => nodeIds.has(node.id) ? 4 : 1.5);
      linkSelection
        .attr('opacity', (link) => {
          const key = `${endpointId(link.source)}→${endpointId(link.target)}`;
          return edgeIds.size === 0 ? 0.6 : (edgeIds.has(key) ? 1 : 0.08);
        })
        .attr('stroke', (link) => {
          const key = `${endpointId(link.source)}→${endpointId(link.target)}`;
          return edgeIds.has(key) ? '#e17055' : '#999';
        })
        .attr('stroke-width', (link) => {
          const key = `${endpointId(link.source)}→${endpointId(link.target)}`;
          const width = edgeWidthScale(link.value);
          return edgeIds.has(key) ? Math.max(3, width) : width;
        });
      return;
    }

    if (!focusedNodeId) return;
    const target = nodeById.get(focusedNodeId);
    if (!target) return;

    const zoom = zoomRef.current;
    if (zoom) {
      const scale = 1.8;
      const { width, height } = dimensionsRef.current;
      const transform = d3.zoomIdentity
        .translate(width / 2 - (target.x ?? 0) * scale, height / 2 - (target.y ?? 0) * scale)
        .scale(scale);
      d3.select(svgElement)
        .interrupt()
        .transition()
        .duration(INTERACTION_DURATION_MS)
        .call(zoom.transform, transform);
    }

    nodeSelection
      .attr('opacity', (node) => node.id === target.id ? 1 : 0.15)
      .select('circle')
      .attr('stroke', (node) => node.id === target.id ? '#e17055' : '#fff')
      .attr('stroke-width', (node) => node.id === target.id ? 6 : 1.5)
      .attr('r', (node) => (
        node.id === target.id
          ? 1.5 * (nodeSizeByGroup[node.group] || 8)
          : (nodeSizeByGroup[node.group] || 8)
      ));
    linkSelection.attr('opacity', (link) => (
      endpointId(link.source) === focusedNodeId || endpointId(link.target) === focusedNodeId ? 1 : 0.07
    ));
  }, [edgeWidthScale, focusedNodeId, highlightEdges, highlightNodeIds, nodeSizeByGroup]);

  const mergedStyle = useMemo<React.CSSProperties>(() => ({
    width: '100vw',
    height: isMobile ? 'calc(100dvh - 56px)' : '100dvh',
    ...svgStyle,
  }), [isMobile, svgStyle]);

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`予算構造グラフ（${nodes.length}ノード、${links.length}リンク）`}
      style={mergedStyle}
    />
  );
});

export default ForceGraph;
