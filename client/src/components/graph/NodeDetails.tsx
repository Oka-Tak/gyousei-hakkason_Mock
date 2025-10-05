"use client";

import React from 'react';
import type { GraphNodeDatum } from '@/features/graph/types';

interface NodeDetailsProps {
  node: GraphNodeDatum;
  isMobile?: boolean;
  onClose?: () => void;
  loadingSpending?: boolean;
}

const NodeDetails: React.FC<NodeDetailsProps> = ({ node, isMobile = false, onClose, loadingSpending }) => {
  const isProject = node.group === 'project_name';
  const projectId = node.project_id ? String(node.project_id) : '';
  const reviewUrl = projectId ? `https://rssystem.go.jp/project?projectNumbers=${projectId}&fiscalYear=2024` : node.url || '#';

  return (
    <div style={isMobile ? { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #ccc', borderRadius: '12px 12px 0 0', padding: 16, zIndex: 102, maxHeight: '60vh', overflowY: 'auto', boxShadow: '0 -4px 16px rgba(0,0,0,0.1)' } : { position: 'absolute', top: 60, right: 20, zIndex: 3, background: '#fff', border: '1px solid #ccc', padding: 12, minWidth: 320, maxWidth: 420, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20 }}>{node.name}</h2>
        {isMobile && (<button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: 4, color: '#666' }}>×</button>)}
      </div>

      {isProject ? (
        <div style={{ margin: '8px 0' }}>
          {projectId ? (
            <a href={reviewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontWeight: 'bold' }}>
              レビューシートを見る（project_id: {projectId}）
            </a>
          ) : (
            <span style={{ color: '#888' }}>レビューシートURL（project_id未設定）</span>
          )}
          {projectId && (
            <div style={{ marginTop: 6 }}>
              <a href={`/project/${encodeURIComponent(projectId)}`} style={{ color: '#07796b', textDecoration: 'underline' }}>この事業を詳しく見る</a>
            </div>
          )}
        </div>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>予算額:</strong> {node.initial_budget ? `${Number(node.initial_budget).toLocaleString()}円` : 'データなし'}
        </div>
        <div>
          <strong>支払先企業一覧:</strong>
          {loadingSpending && (<div style={{ color: '#64748b', fontSize: isMobile ? 12 : 13, marginTop: 4 }}>取得中...</div>)}
          <ul style={{ margin: '6px 0 0 0', padding: 0, listStyle: 'none', maxHeight: isMobile ? 150 : 160, overflowY: 'auto', fontSize: isMobile ? 13 : 14 }}>
            {(node.spending_list && node.spending_list.length > 0) ? (
              node.spending_list.map((sp: any, idx: number) => (
                <li key={idx} style={{ borderBottom: '1px solid #eee', padding: '2px 0' }}>
                  {sp.recipient_name || '(名称不明)'}
                  {sp.corporate_number ? `（法人番号: ${sp.corporate_number}）` : ''}
                  {sp.amount ? ` 金額: ${Number(sp.amount).toLocaleString()}円` : ''}
                </li>
              ))
            ) : (
              <li style={{ color: '#888' }}>支払先データなし</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NodeDetails;
