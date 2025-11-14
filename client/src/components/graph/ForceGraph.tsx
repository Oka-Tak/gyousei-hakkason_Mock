"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphNodeDatum, GraphLinkDatum } from '@/features/graph/types';
import { formatJaYen } from '@/utils/format';

export type NodeSizeMap = Record<string, number>;

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
  highlightNodeIds?: string[];
  highlightEdges?: Array<{ sourceId: string; targetId: string }>;
  onNodeClick?: (node: GraphNodeDatum, event: any) => void;
  onBackgroundClick?: () => void;
  onZoomReady?: (zoom: d3.ZoomBehavior<Element, unknown>) => void;
  svgStyle?: React.CSSProperties;
  showTopLevelLabels?: boolean;
}

const ForceGraph: React.FC<ForceGraphProps> = (props) => {
  const { nodes, links, colorMap, nodeSizeByGroup, isMobile = false, width: widthProp, height: heightProp, linkDistance: linkDistanceProp, chargeStrength: chargeStrengthProp, focusedNodeId = null, highlightNodeIds = [], highlightEdges = [], onNodeClick, onBackgroundClick, onZoomReady, svgStyle, showTopLevelLabels = false } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);

  const metrics = useMemo(() => {
    const minEdgeWidth = 1.5;
    const maxEdgeWidth = 30;
    const minLinkValue = d3.min(links, d => d.value) || 0;
    const maxLinkValue = d3.max(links, d => d.value) || 1;
    const edgeWidthScale = d3.scaleLinear().domain([minLinkValue, maxLinkValue]).range([minEdgeWidth, maxEdgeWidth]);
    return { edgeWidthScale };
  }, [links]);

  useEffect(() => {
    if (!svgRef.current) return;
    const width = widthProp ?? window.innerWidth;
    const height = heightProp ?? (isMobile ? window.innerHeight - 56 : window.innerHeight);

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('width', widthProp ? `${width}px` : '100vw')
      .style('height', heightProp ? `${height}px` : (isMobile ? 'calc(100vh - 56px)' : '100vh'))
      .html('');

    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');
    const linkGroup = zoomLayer.append('g').attr('class', 'links');
    const nodeGroup = zoomLayer.append('g').attr('class', 'nodes');

    const zoomed = (event: d3.D3ZoomEvent<Element, unknown>) => {
      zoomLayer.attr('transform', event.transform.toString());
    };
    const zoom = d3.zoom<Element, unknown>().scaleExtent([0.1, 4]).on('zoom', zoomed);
    zoomRef.current = zoom;
    (svg as any).call(zoom);
    (svg as any).call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));
    onZoomReady && onZoomReady(zoom);

    const link = linkGroup.selectAll('line').data(links).join('line')
      .attr('stroke-width', d => metrics.edgeWidthScale(d.value))
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6);

    const nodeEnter = nodeGroup.selectAll<SVGGElement, GraphNodeDatum>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .call(d3.drag<SVGGElement, GraphNodeDatum, GraphNodeDatum>()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    nodeEnter.append('circle')
      .attr('r', d => nodeSizeByGroup[d.group] || 8)
      .attr('fill', d => colorMap[d.topLevel] || '#1976d2')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .on('click', (event, d) => { event.stopPropagation(); onNodeClick && onNodeClick(d, event); });

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

    nodeEnter.filter(d => d.group !== 'agency_name' && d.group !== 'ministry_name')
      .append('path')
      .attr('d', d => iconPaths[d.group] || iconPaths['unknown'])
      .attr('fill', '#fff')
      .attr('stroke', 'none')
      .attr('transform', d => { const r = nodeSizeByGroup[d.group] || 8; return `scale(${(r / 12) * 0.7}) translate(-12,-12)`; });

    if (showTopLevelLabels) {
      nodeEnter
        .filter(d => d.group === 'agency_name' || d.group === 'ministry_name')
        .append('text')
        .attr('class', 'node-label')
        .text(d => d.name)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('alignment-baseline', 'middle')
        .attr('y', 0)
        .attr('fill', '#fff')
        .attr('font-weight', 700)
        .attr('font-size', d => {
          const r = nodeSizeByGroup[d.group] || 8;
          const max = isMobile ? 12 : 13;
          const min = isMobile ? 8 : 9;
          return Math.max(min, Math.min(max, Math.round(r * 0.5)));
        })
        .attr('paint-order', 'stroke')
        .attr('stroke', 'rgba(0,0,0,0.45)')
        .attr('stroke-width', 3)
        .style('pointer-events', 'none');
    }

    // Native tooltip
    nodeEnter.append('title').text(d => `${d.name}\n${formatJaYen(d.value || 0)}`);

    const minRadius = 120;
    const radiusStep = 120;
    const nodeLevels = new Map<GraphNodeDatum, number>();
    nodes.forEach(n => nodeLevels.set(n, Math.max(0, n.id.split('→').length - 1)));
    const baseLinkDistance = isMobile ? 140 : 180;
    const baseChargeStrength = isMobile ? -300 : -600;
    const linkDistance = linkDistanceProp ?? baseLinkDistance;
    const chargeStrength = chargeStrengthProp ?? baseChargeStrength;

    const simulation = d3.forceSimulation<GraphNodeDatum, GraphLinkDatum>(nodes)
      .force('link', d3.forceLink<GraphNodeDatum, GraphLinkDatum>(links).id(d => d.id).distance(linkDistance))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNodeDatum>().radius(d => (nodeSizeByGroup[d.group] || 8) + 2))
      .force('radial', d3.forceRadial<GraphNodeDatum>(d => minRadius + (nodeLevels.get(d) || 0) * radiusStep, width / 2, height / 2).strength(1));

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNodeDatum).x!)
        .attr('y1', d => (d.source as GraphNodeDatum).y!)
        .attr('x2', d => (d.target as GraphNodeDatum).x!)
        .attr('y2', d => (d.target as GraphNodeDatum).y!);
      nodeEnter.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    svg.on('click', () => { onBackgroundClick && onBackgroundClick(); });
    return () => { svg.on('.zoom', null); };
  }, [nodes, links, colorMap, nodeSizeByGroup, isMobile, widthProp, heightProp, showTopLevelLabels]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const hasHighlight = (highlightNodeIds && highlightNodeIds.length > 0) || (highlightEdges && highlightEdges.length > 0);
    if (hasHighlight) {
      const nodeSet = new Set(highlightNodeIds);
      const edgeSet = new Set<string>();
      highlightEdges.forEach(e => { edgeSet.add(`${e.sourceId}→${e.targetId}`); edgeSet.add(`${e.targetId}→${e.sourceId}`); });
      svg.selectAll('.node-group').select('circle')
        .attr('opacity', (d: any) => nodeSet.size === 0 ? 1 : (nodeSet.has(d.id) ? 1 : 0.12))
        .attr('stroke', (d: any) => nodeSet.has(d.id) ? '#e17055' : '#fff')
        .attr('stroke-width', (d: any) => nodeSet.has(d.id) ? 4 : 1.5);
      svg.selectAll('.node-group').select('.node-label')
        .attr('opacity', (d: any) => nodeSet.size === 0 ? 1 : (nodeSet.has(d.id) ? 1 : 0.12));
      svg.selectAll('.links line')
        .attr('opacity', (l: any) => edgeSet.size === 0 ? 0.6 : (edgeSet.has(`${l.source.id}→${l.target.id}`) ? 1 : 0.08))
        .attr('stroke', (l: any) => edgeSet.has(`${l.source.id}→${l.target.id}`) ? '#e17055' : '#999')
        .attr('stroke-width', (l: any) => edgeSet.has(`${l.source.id}→${l.target.id}`) ? Math.max(3, metrics.edgeWidthScale(l.value)) : metrics.edgeWidthScale(l.value));
    } else if (focusedNodeId) {
      const target = nodes.find(n => n.id === focusedNodeId);
      if (!target) return;
      const scale = 1.8;
      const x = target.x ?? 0;
      const y = target.y ?? 0;
      if (zoomRef.current) {
        const containerW = widthProp ?? window.innerWidth;
        const containerH = heightProp ?? (isMobile ? window.innerHeight - 56 : window.innerHeight);
        const tx = containerW / 2 - x * scale;
        const ty = containerH / 2 - y * scale;
        svg.transition().duration(400).call((zoomRef.current as any).transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
      svg.selectAll('.node-group').select('circle')
        .attr('stroke', (d: any) => d.id === target.id ? '#e17055' : '#fff')
        .attr('stroke-width', (d: any) => d.id === target.id ? 6 : 1.5)
        .attr('r', (d: any) => d.id === target.id ? 1.5 * (nodeSizeByGroup[d.group as string] || 8) : (nodeSizeByGroup[d.group as string] || 8))
        .attr('opacity', (d: any) => d.id === target.id ? 1 : 0.15);
      svg.selectAll('.node-group').select('.node-label')
        .attr('opacity', (d: any) => d.id === target.id ? 1 : 0.15);
      svg.selectAll('.links line')
        .attr('opacity', (l: any) => (l.source.id === focusedNodeId || l.target.id === focusedNodeId) ? 1 : 0.07);
    } else {
      svg.selectAll('.node-group').select('circle')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('r', (d: any) => nodeSizeByGroup[d.group as string] || 8)
        .attr('opacity', 1);
      svg.selectAll('.node-group').select('.node-label').attr('opacity', 1);
      svg.selectAll('.links line').attr('opacity', 0.6);
    }
  }, [focusedNodeId, nodes, nodeSizeByGroup, widthProp, heightProp, isMobile, highlightNodeIds, highlightEdges, metrics.edgeWidthScale]);

  const mergedStyle = useMemo(() => ({
    width: '100vw',
    height: isMobile ? 'calc(100vh - 56px)' : '100vh',
    ...svgStyle,
  }), [svgStyle, isMobile]);

  return <svg ref={svgRef} style={mergedStyle} />;
};

export default ForceGraph;
