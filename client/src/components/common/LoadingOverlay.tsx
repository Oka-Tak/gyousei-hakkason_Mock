"use client";

import React from 'react';

interface LoadingOverlayProps {
  title?: string;
  message?: string;
  variant?: 'pulse' | 'bounce';
  dotsCount?: number;
  accentColor?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ title = 'Loading', message = '読み込み中...', variant = 'pulse', dotsCount = 3, accentColor = '#07796b' }) => {
  const dots = Array.from({ length: dotsCount }, (_, i) => i);
  const isPulse = variant === 'pulse';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: accentColor, margin: 0, letterSpacing: '0.05em' }}>{title}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dots.map((i) => (<div key={i} style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: accentColor, animation: `${isPulse ? 'pulse' : 'bounce'} 1.5s infinite ${i * 0.15}s` }} />))}
        </div>
        <p style={{ fontSize: 16, color: '#64748b', margin: 0, textAlign: 'center' }}>{message}</p>
      </div>
      <style jsx>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.3); opacity: 1; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.6; } 50% { transform: translateY(-10px); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;

