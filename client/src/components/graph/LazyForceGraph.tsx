"use client";

import { useEffect, useRef, useState } from 'react';
import ForceGraph, { type ForceGraphProps } from '@/components/graph/ForceGraph';

export default function LazyForceGraph(props: ForceGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShouldRender(true);
      observer.disconnect();
    }, { rootMargin: '240px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: props.width ?? '100%',
        height: props.height ?? 280,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {shouldRender ? (
        <ForceGraph {...props} />
      ) : (
        <div role="status" style={{ color: '#64748b', fontSize: 12 }}>
          グラフを準備しています
        </div>
      )}
    </div>
  );
}
