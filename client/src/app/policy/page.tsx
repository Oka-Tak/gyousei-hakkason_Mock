"use client";

import React, { useEffect, useMemo, useState } from 'react';

type PolicyItem = { project_id: string; project_name: string; policy_no: string; ministry: string; policy: string; program: string; url: string; law_name: string };

const PolicyPage: React.FC = () => {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { (async () => { try { setLoading(true); const res = await fetch(`/api/policies?q=${encodeURIComponent(q)}`); const json = await res.json(); setItems(json.items || []); } catch(e:any) { setError(e.message);} finally { setLoading(false);} })(); }, [q]);

  const grouped = useMemo(() => {
    const map = new Map<string, PolicyItem[]>();
    for (const it of items) {
      const key = it.policy || it.law_name || '(未設定)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: 18 }}>
        <h1 style={{ margin: 0 }}>政策・法令ナビ</h1>
        <p style={{ marginTop: 6 }}>キーワードで検索すると、関係する事業がまとまって表示されます。</p>
        <input placeholder="例: 教育, 省エネ, 法律名…" value={q} onChange={(e)=>setQ(e.target.value)} style={{ marginTop: 8, width: '100%', maxWidth: 420, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
      </header>

      {loading && <div>読み込み中...</div>}
      {error && <div style={{ color: 'crimson' }}>エラー: {error}</div>}

      {grouped.map(([key, list]) => (
        <section key={key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{key}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {list.slice(0, 8).map((it, idx) => (
              <div key={idx} style={{ border: '1px solid #eef2f7', borderRadius: 10, padding: '6px 8px', background: '#f8fafc' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{it.ministry || ''}</div>
                <a href={`/project/${encodeURIComponent(it.project_id)}`} style={{ fontWeight: 700 }}>{it.project_name || it.project_id}</a>
                {it.url && <div><a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>政策URL</a></div>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default PolicyPage;

