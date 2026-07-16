"use client";

import type { RefObject } from 'react';
import type { ForceGraphHandle } from '@/components/graph/ForceGraph';

interface ZoomControlsProps {
  graphRef: RefObject<ForceGraphHandle | null>;
  isMobile?: boolean;
}

const buttonStyle = {
  inlineSize: 40,
  blockSize: 40,
  borderRadius: 8,
  background: '#fff',
  border: '1px solid #ccc',
  cursor: 'pointer',
} as const;

export default function ZoomControls({ graphRef, isMobile = false }: ZoomControlsProps) {
  return (
    <div style={{
      position: 'absolute',
      left: isMobile ? 10 : 20,
      bottom: isMobile ? 10 : 20,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <button
        type="button"
        style={{ ...buttonStyle, fontSize: 24 }}
        onClick={() => graphRef.current?.zoomBy(1.2)}
        aria-label="拡大"
      >
        ＋
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, fontSize: 24 }}
        onClick={() => graphRef.current?.zoomBy(1 / 1.2)}
        aria-label="縮小"
      >
        －
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, fontSize: 20 }}
        onClick={() => graphRef.current?.resetZoom()}
        aria-label="中心に戻る"
      >
        ⦿
      </button>
    </div>
  );
}
