"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useMainGraphData } from '@/features/graph/hooks/useGraphData';
import Money from '@/components/common/Money';

const RecipientsPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const f = () => setIsMobile(window.innerWidth <= 600); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  const { allAgencies } = useMainGraphData([]);
  const agencies = useMemo(() => allAgencies || [], [allAgencies]);

  const [agency, setAgency] = useState('');
  const [limit, setLimit] = useState(20);
  const [items, setItems] = useState<Array<{ recipient_name: string; corporate_number: string | null; total_amount: number; projects_count: number }>>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (ag: string, lim: number) => {
    if (!ag) return;
    try {
      setLoading(true); setError(null);
      const res = await fetch(`/api/insights/recipients?agency=${encodeURIComponent(ag)}&limit=${lim}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.recipients || []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (agency) load(agency, limit); }, [agency, limit]);

  const filtered = useMemo(() => items.filter(r => !q || (r.recipient_name || '').toLowerCase().includes(q.toLowerCase())), [items, q]);

  return (
    <div style={{ padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: isMobile ? 16 : 22 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28 }}>受取先を見てみる（だれが）</h1>
        <p style={{ marginTop: 6 }}>省庁を選んで、上位の受取先を横断的に確認できます。気になる受取先はクリップして、会話のきっかけに。</p>
      </header>

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input list="agency-list" placeholder="例: 総務省" value={agency} onChange={(e) => setAgency(e.target.value)} style={{ flex: '1 1 260px', minWidth: 220, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
        <datalist id="agency-list">{agencies.map(a => <option key={a} value={a} />)}</datalist>
        <input placeholder="受取先名で絞り込み" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px', minWidth: 200, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }}>
          <option value={10}>10件</option>
          <option value={20}>20件</option>
          <option value={30}>30件</option>
        </select>
        <button onClick={() => agency && load(agency, limit)} style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>更新</button>
      </section>

      {loading && <div>読み込み中...</div>}
      {error && <div style={{ color: 'crimson' }}>エラー: {error}</div>}

      {!!agency && (
        <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          {filtered.map((r) => (
            <div key={`${r.recipient_name}::${r.corporate_number ?? ''}`} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{r.recipient_name || '不明'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{r.corporate_number || '法人番号なし'}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>関連プロジェクト: {r.projects_count}</div>
              </div>
              <div style={{ fontWeight: 800 }}><Money amount={r.total_amount} /></div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                <button onClick={() => navigator.clipboard.writeText(`${r.recipient_name} ${r.corporate_number ?? ''}`.trim())} style={{ border: '1px solid #ddd', background: '#f8fafc', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>コピー</button>
                <button onClick={() => agency && (location.href = `/subgraph?node=${encodeURIComponent(agency)}`)} style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>グラフで見る</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default RecipientsPage;

