"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMainGraphData } from '@/features/graph/hooks/useGraphData';
import Money from '@/components/common/Money';

type CompareType = 'agency' | 'project';

type Summary = {
  target: { type: CompareType; value?: string; projectId?: number; label: string };
  total: number;
  projectCount: number;
  firstLevel: { name: string; value: number }[];
};

type RecItem = { recipient_name: string; corporate_number: string | null; total_amount: number; projects_count: number };

type CompareRequest = { type: 'agency'; value: string } | { type: 'project'; projectId: number };

type ProjectMatch = { projectId: number; label: string; score: number; surface?: string | null };

const MIN_QUERY_LENGTH = 2;

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return '不明なエラーが発生しました';
  }
}

async function fetchSummary(target: CompareRequest): Promise<Summary> {
  const params = new URLSearchParams({ type: target.type });
  if (target.type === 'agency') params.set('value', target.value);
  else params.set('projectId', String(target.projectId));
  const res = await fetch(`/api/compare/summary?${params.toString()}`);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `summary ${res.status}`);
  }
  const json = await res.json();
  return json.summary as Summary;
}

async function fetchRecipients(target: CompareRequest, limit = 5): Promise<RecItem[]> {
  const params = new URLSearchParams({ type: target.type, limit: String(limit) });
  if (target.type === 'agency') params.set('value', target.value);
  else params.set('projectId', String(target.projectId));
  const res = await fetch(`/api/compare/recipients?${params.toString()}`);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `recipients ${res.status}`);
  }
  const json = await res.json();
  return (json.recipients || []) as RecItem[];
}

async function searchProjects(query: string, signal?: AbortSignal): Promise<ProjectMatch[]> {
  const params = new URLSearchParams({ q: query, limit: '20' });
  const res = await fetch(`/api/search/project?${params.toString()}`, { signal });
  if (!res.ok) {
    const raw = await res.text();
    let message = `検索に失敗しました (status ${res.status})`;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.error === 'string') message = parsed.error;
        else if (parsed?.error?.message) message = parsed.error.message;
        else message = raw;
      } catch {
        message = raw;
      }
    }
    throw new Error(message);
  }
  const json = await res.json();
  const matches = (json.matches || []) as Array<{ projectId: number; projectName: string; score: number; surface?: string | null }>;
  return matches.map((m) => ({ projectId: m.projectId, label: m.projectName, score: m.score, surface: m.surface }));
}

const toggleButtonStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 12,
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid ${active ? '#07796b' : '#cbd5e1'}`,
  background: active ? '#07796b' : '#fff',
  color: active ? '#fff' : '#1e293b',
  cursor: 'pointer',
  transition: 'all 0.15s ease-out',
});

const ComparePage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 600);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const { allAgencies } = useMainGraphData([]);
  const agencies = useMemo(() => allAgencies || [], [allAgencies]);

  const [leftType, setLeftType] = useState<CompareType>('agency');
  const [rightType, setRightType] = useState<CompareType>('agency');
  const [leftInput, setLeftInput] = useState('');
  const [rightInput, setRightInput] = useState('');
  const [leftProjectSelection, setLeftProjectSelection] = useState<ProjectMatch | null>(null);
  const [rightProjectSelection, setRightProjectSelection] = useState<ProjectMatch | null>(null);
  const [leftSuggestions, setLeftSuggestions] = useState<ProjectMatch[]>([]);
  const [rightSuggestions, setRightSuggestions] = useState<ProjectMatch[]>([]);
  const [leftSearchLoading, setLeftSearchLoading] = useState(false);
  const [rightSearchLoading, setRightSearchLoading] = useState(false);
  const [leftSearchError, setLeftSearchError] = useState<string | null>(null);
  const [rightSearchError, setRightSearchError] = useState<string | null>(null);

  const [leftSummary, setLeftSummary] = useState<Summary | null>(null);
  const [rightSummary, setRightSummary] = useState<Summary | null>(null);
  const [leftRecipients, setLeftRecipients] = useState<RecItem[]>([]);
  const [rightRecipients, setRightRecipients] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leftSearchAbort = useRef<AbortController | null>(null);
  const rightSearchAbort = useRef<AbortController | null>(null);

  const resetLeftProjectState = useCallback(() => {
    leftSearchAbort.current?.abort();
    setLeftProjectSelection(null);
    setLeftSuggestions([]);
    setLeftSearchError(null);
    setLeftSearchLoading(false);
  }, []);

  const resetRightProjectState = useCallback(() => {
    rightSearchAbort.current?.abort();
    setRightProjectSelection(null);
    setRightSuggestions([]);
    setRightSearchError(null);
    setRightSearchLoading(false);
  }, []);

  const setLeftInputValue = useCallback((value: string, options?: { preserveSelection?: boolean }) => {
    setLeftInput(value);
    if (leftType === 'project' && !options?.preserveSelection) {
      setLeftProjectSelection(null);
    }
  }, [leftType]);

  const setRightInputValue = useCallback((value: string, options?: { preserveSelection?: boolean }) => {
    setRightInput(value);
    if (rightType === 'project' && !options?.preserveSelection) {
      setRightProjectSelection(null);
    }
  }, [rightType]);

  const performProjectSearch = useCallback(
    async (side: 'left' | 'right') => {
      const isLeft = side === 'left';
      const query = (isLeft ? leftInput : rightInput).trim();
      const currentType = isLeft ? leftType : rightType;
      const setLoading = isLeft ? setLeftSearchLoading : setRightSearchLoading;
      const setErrorState = isLeft ? setLeftSearchError : setRightSearchError;
      const setSuggestions = isLeft ? setLeftSuggestions : setRightSuggestions;
      const abortRef = isLeft ? leftSearchAbort : rightSearchAbort;

      if (currentType !== 'project') return;

      if (!query) {
        abortRef.current?.abort();
        setSuggestions([]);
        setErrorState(null);
        setLoading(false);
        return;
      }

      if (query.length < MIN_QUERY_LENGTH) {
        abortRef.current?.abort();
        setSuggestions([]);
        setErrorState('2文字以上で検索してください');
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErrorState(null);

      try {
        const matches = await searchProjects(query, controller.signal);
        setSuggestions(matches);
        if (!matches.length) {
          setErrorState('候補が見つかりませんでした');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setErrorState(extractErrorMessage(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [leftInput, rightInput, leftType, rightType],
  );

  const runComparison = useCallback(
    async (leftReq: CompareRequest, rightReq: CompareRequest, updateUrl = false) => {
      try {
        setLoading(true);
        setError(null);

        const [leftSummaryData, rightSummaryData, leftRecipientsData, rightRecipientsData] = await Promise.all([
          fetchSummary(leftReq),
          fetchSummary(rightReq),
          fetchRecipients(leftReq, 5),
          fetchRecipients(rightReq, 5),
        ]);

        setLeftSummary(leftSummaryData);
        setRightSummary(rightSummaryData);
        setLeftRecipients(leftRecipientsData);
        setRightRecipients(rightRecipientsData);

        if (updateUrl) {
          const params = new URLSearchParams();
          params.set('typeA', leftReq.type);
          if (leftReq.type === 'agency') {
            params.set('valueA', leftReq.value);
          } else {
            params.set('projectIdA', String(leftReq.projectId));
            params.set('nameA', leftSummaryData.target.label);
          }
          params.set('typeB', rightReq.type);
          if (rightReq.type === 'agency') {
            params.set('valueB', rightReq.value);
          } else {
            params.set('projectIdB', String(rightReq.projectId));
            params.set('nameB', rightSummaryData.target.label);
          }
          const query = params.toString();
          window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
        }
      } catch (err) {
        setLeftSummary(null);
        setRightSummary(null);
        setLeftRecipients([]);
        setRightRecipients([]);
        const message = extractErrorMessage(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleCompare = useCallback(async () => {
    if (leftType === 'agency' && !leftInput.trim()) {
      setError('左側の府省庁を入力してください');
      return;
    }
    if (rightType === 'agency' && !rightInput.trim()) {
      setError('右側の府省庁を入力してください');
      return;
    }
    if (leftType === 'project' && !leftProjectSelection) {
      setError('左側のプロジェクト候補を選択してください');
      return;
    }
    if (rightType === 'project' && !rightProjectSelection) {
      setError('右側のプロジェクト候補を選択してください');
      return;
    }

    const leftReq: CompareRequest =
      leftType === 'agency'
        ? { type: 'agency', value: leftInput.trim() }
        : { type: 'project', projectId: leftProjectSelection!.projectId };
    const rightReq: CompareRequest =
      rightType === 'agency'
        ? { type: 'agency', value: rightInput.trim() }
        : { type: 'project', projectId: rightProjectSelection!.projectId };

    try {
      await runComparison(leftReq, rightReq, true);
    } catch (err) {
      console.error(err);
    }
  }, [leftType, leftInput, leftProjectSelection, rightType, rightInput, rightProjectSelection, runComparison]);

  const handleClear = useCallback(() => {
    setLeftType('agency');
    setRightType('agency');
    setLeftInputValue('', { preserveSelection: true });
    setRightInputValue('', { preserveSelection: true });
    leftSearchAbort.current?.abort();
    rightSearchAbort.current?.abort();
    resetLeftProjectState();
    resetRightProjectState();
    setLeftSummary(null);
    setRightSummary(null);
    setLeftRecipients([]);
    setRightRecipients([]);
    setError(null);
    window.history.replaceState(null, '', window.location.pathname);
  }, [resetLeftProjectState, resetRightProjectState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const typeA = sp.get('typeA') === 'project' ? 'project' : 'agency';
    const typeB = sp.get('typeB') === 'project' ? 'project' : 'agency';

    setLeftType(typeA);
    setRightType(typeB);

    let leftPrefill: CompareRequest | null = null;
    let rightPrefill: CompareRequest | null = null;

    if (typeA === 'agency') {
      const valueA = sp.get('valueA') || '';
      setLeftInputValue(valueA, { preserveSelection: true });
      if (valueA) leftPrefill = { type: 'agency', value: valueA };
    } else {
      const projectIdA = Number(sp.get('projectIdA') || '');
      const nameA = sp.get('nameA') || '';
      if (Number.isFinite(projectIdA) && projectIdA > 0) {
        const label = nameA || `プロジェクトID ${projectIdA}`;
        setLeftInputValue(label, { preserveSelection: true });
        setLeftProjectSelection({ projectId: projectIdA, label, score: 0 });
        leftPrefill = { type: 'project', projectId: projectIdA };
      }
    }

    if (typeB === 'agency') {
      const valueB = sp.get('valueB') || '';
      setRightInputValue(valueB, { preserveSelection: true });
      if (valueB) rightPrefill = { type: 'agency', value: valueB };
    } else {
      const projectIdB = Number(sp.get('projectIdB') || '');
      const nameB = sp.get('nameB') || '';
      if (Number.isFinite(projectIdB) && projectIdB > 0) {
        const label = nameB || `プロジェクトID ${projectIdB}`;
        setRightInputValue(label, { preserveSelection: true });
        setRightProjectSelection({ projectId: projectIdB, label, score: 0 });
        rightPrefill = { type: 'project', projectId: projectIdB };
      }
    }

    if (leftPrefill && rightPrefill) {
      runComparison(leftPrefill, rightPrefill).catch(() => undefined);
    }
  }, [runComparison]);

  useEffect(() => () => {
    leftSearchAbort.current?.abort();
    rightSearchAbort.current?.abort();
  }, []);

  const fields = useMemo(() => (
    [
      {
        side: 'left' as const,
        type: leftType,
        setType: setLeftType,
        input: leftInput,
        setInput: (val: string, options?: { preserveSelection?: boolean }) => setLeftInputValue(val, options),
        projectSelection: leftProjectSelection,
        setProjectSelection: setLeftProjectSelection,
        suggestions: leftSuggestions,
        setSuggestions: setLeftSuggestions,
        loading: leftSearchLoading,
        error: leftSearchError,
        setError: setLeftSearchError,
        performSearch: () => performProjectSearch('left'),
      },
      {
        side: 'right' as const,
        type: rightType,
        setType: setRightType,
        input: rightInput,
        setInput: (val: string, options?: { preserveSelection?: boolean }) => setRightInputValue(val, options),
        projectSelection: rightProjectSelection,
        setProjectSelection: setRightProjectSelection,
        suggestions: rightSuggestions,
        setSuggestions: setRightSuggestions,
        loading: rightSearchLoading,
        error: rightSearchError,
        setError: setRightSearchError,
        performSearch: () => performProjectSearch('right'),
      },
    ]
  ), [
    leftType,
    leftInput,
    leftProjectSelection,
    leftSuggestions,
    leftSearchLoading,
    leftSearchError,
    setLeftInputValue,
    rightType,
    rightInput,
    rightProjectSelection,
    rightSuggestions,
    rightSearchLoading,
    rightSearchError,
    setRightInputValue,
    performProjectSearch,
  ]);

  return (
    <div style={{ padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: isMobile ? 16 : 22 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28 }}>くらべる（A/B）</h1>
        <p style={{ marginTop: 6 }}>府省庁どうし、またはプロジェクトどうしを並べて違いを把握できます。</p>
      </header>

      <section
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 12,
          alignItems: isMobile ? 'stretch' : 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flex: '1 1 auto', gap: 12, flexWrap: 'wrap' }}>
          {fields.map((cfg) => (
            <div key={cfg.side} style={{ flex: '1 1 260px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{cfg.side === 'left' ? '左対象' : '右対象'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['agency', 'project'] as CompareType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      cfg.setType(type);
                      cfg.setError(null);
                      (cfg.side === 'left' ? leftSearchAbort : rightSearchAbort).current?.abort();
                      if (type === 'agency') {
                        cfg.setProjectSelection(null);
                        cfg.setSuggestions([]);
                      } else {
                        cfg.setInput('');
                        cfg.setProjectSelection(null);
                        cfg.setSuggestions([]);
                      }
                    }}
                    style={toggleButtonStyle(cfg.type === type)}
                  >
                    {type === 'agency' ? '府省庁' : 'プロジェクト'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    list={cfg.type === 'agency' ? 'agency-list' : undefined}
                    placeholder={cfg.type === 'agency' ? '例: 総務省' : 'プロジェクト名やキーワード'}
                    value={cfg.input}
                    onChange={(e) => {
                      const val = e.target.value;
                      cfg.setInput(val);
                      if (cfg.type === 'project') {
                        (cfg.side === 'left' ? leftSearchAbort : rightSearchAbort).current?.abort();
                        cfg.setSuggestions([]);
                        cfg.setError(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && cfg.type === 'project') {
                        e.preventDefault();
                        cfg.performSearch();
                      }
                    }}
                    style={{
                      width: '100%',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}
                  />
                  {cfg.type === 'project' && (cfg.loading || cfg.suggestions.length > 0 || cfg.error) && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)',
                        zIndex: 10,
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {cfg.loading && <div style={{ padding: '10px 12px', fontSize: 12, color: '#475569' }}>検索中...</div>}
                      {!cfg.loading && cfg.suggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.projectId}-${suggestion.label}`}
                          type="button"
                          onClick={() => {
                            cfg.setProjectSelection(suggestion);
                            cfg.setInput(suggestion.label, { preserveSelection: true });
                            cfg.setSuggestions([]);
                            cfg.setError(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: 4,
                            border: 'none',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{suggestion.label}</div>
                          <div style={{ fontSize: 11, color: '#475569' }}>{`一致度 ${(suggestion.score * 100).toFixed(1)}%`}</div>
                        </button>
                      ))}
                      {!cfg.loading && cfg.error && (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: '#dc2626' }}>{cfg.error}</div>
                      )}
                    </div>
                  )}
                </div>
                {cfg.type === 'project' && (
                  <button
                    type="button"
                    onClick={cfg.performSearch}
                    style={{
                      border: '1px solid #0f766e',
                      background: '#0f766e',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    候補検索
                  </button>
                )}
              </div>
              {cfg.type === 'project' && cfg.projectSelection && (
                <div style={{ fontSize: 11, color: '#16a34a' }}>候補を選択済み: ID {cfg.projectSelection.projectId}</div>
              )}
              {cfg.type === 'project' && !cfg.projectSelection && cfg.error && (
                <div style={{ fontSize: 11, color: '#dc2626' }}>{cfg.error}</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleCompare}
            style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}
          >
            くらべる
          </button>
          <button
            type="button"
            onClick={handleClear}
            style={{ border: '1px solid #cbd5e1', background: '#f8fafc', color: '#1e293b', padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}
          >
            クリア
          </button>
        </div>
      </section>

      <datalist id="agency-list">{agencies.map((a) => <option key={a} value={a} />)}</datalist>

      {loading && <div>読み込み中...</div>}
      {error && <div style={{ color: 'crimson' }}>エラー: {error}</div>}

      {leftSummary && rightSummary && (
        <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {[{ summary: leftSummary, recipients: leftRecipients }, { summary: rightSummary, recipients: rightRecipients }].map(({ summary, recipients }, idx) => {
            const typeLabel = summary.target.type === 'agency' ? '府省庁' : 'プロジェクト';
            const actionLabel = summary.target.type === 'agency' ? 'グラフで見る' : '事業詳細を見る';
            const actionHref = summary.target.type === 'agency'
              ? `/subgraph?node=${encodeURIComponent(summary.target.label)}`
              : `/project/${summary.target.projectId}`;
            const projectCountLabel = summary.target.type === 'agency' ? 'プロジェクト数' : '対象事業';

            return (
              <div key={idx} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 20 }}>{summary.target.label}</div>
                  <span
                    style={{
                      fontSize: 11,
                      background: summary.target.type === 'agency' ? '#0ea5e9' : '#9333ea',
                      color: '#fff',
                      padding: '3px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {typeLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>合計</div>
                    <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22 }}><Money amount={summary.total} /></div>
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{projectCountLabel}</div>
                    <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22 }}>
                      {summary.target.type === 'agency' ? summary.projectCount.toLocaleString('ja-JP') : '1件'}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>内訳（第一階層 上位）</div>
                  {summary.firstLevel.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>内訳データがありません。</div>}
                  {summary.firstLevel.slice(0, 5).map((item) => (
                    <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 12, color: '#334155' }}>{item.name}</div>
                      <div style={{ background: '#e2f6f2', height: 8, borderRadius: 999 }}>
                        <div
                          style={{
                            width: `${Math.min(100, summary.total > 0 ? (item.value / summary.total) * 100 : 0)}%`,
                            background: '#07796b',
                            height: 8,
                            borderRadius: 999,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 12, textAlign: 'right' }}><Money amount={item.value} /></div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>上位受取先</div>
                  {recipients.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>受取先情報が見つかりませんでした。</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                    {recipients.map((recipient) => (
                      <div
                        key={`${recipient.recipient_name}::${recipient.corporate_number ?? ''}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 8,
                          alignItems: 'center',
                          border: '1px solid #eef2f7',
                          borderRadius: 10,
                          padding: '8px 10px',
                          background: '#f8fafc',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{recipient.recipient_name || '不明'}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{recipient.corporate_number || '法人番号なし'}</div>
                        </div>
                        <div style={{ fontWeight: 800 }}><Money amount={recipient.total_amount} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { window.location.href = actionHref; }}
                    style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    {actionLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default ComparePage;
