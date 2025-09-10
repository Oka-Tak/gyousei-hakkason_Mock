"use client";

import React from 'react';
import spotlightStyles from '../../src/app/SpotlightSearch.module.css';

export interface SearchResultItem {
  id: string;
  name: string;
}

interface ControlsProps {
  isMobile?: boolean;
  // spotlight
  showSpotlight: boolean;
  onOpenSpotlight: () => void;
  onCloseSpotlight: () => void;
  search: string;
  onChangeSearch: (v: string) => void;
  currentIndex: number;
  hitsCount: number;
  onPrev: () => void;
  onNext: () => void;
  results: SearchResultItem[];
  onPickResult: (id: string, index: number) => void;

  // agency filters (optional)
  agencies?: string[];
  visibleAgencies?: string[];
  onToggleAgency?: (agency: string, next: boolean) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isMobile = false,
  showSpotlight,
  onOpenSpotlight,
  onCloseSpotlight,
  search,
  onChangeSearch,
  currentIndex,
  hitsCount,
  onPrev,
  onNext,
  results,
  onPickResult,
  agencies,
  visibleAgencies,
  onToggleAgency,
}) => {
  return (
    <>
      {/* top bar */}
      <div
        style={isMobile ? {
          position: 'absolute', top: 0, left: 0, width: '100vw', zIndex: 10, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 0 2px 0',
        } : {
          position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 10, background: '#fff', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '8px 0',
        }}
      >
        <h1 style={{ margin: 0, fontSize: isMobile ? 17 : 24, flex: 'none', color: '#333' }}>ZAIMYAKU</h1>
        <button
          style={isMobile ? {
            marginTop: 2, background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: '6px 16px', fontSize: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', alignSelf: 'center',
          } : {
            marginLeft: 24, background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: '8px 20px', fontSize: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer',
          }}
          onClick={onOpenSpotlight}
          aria-label="検索を開く"
        >🔍 検索</button>
      </div>

      {/* spotlight */}
      {showSpotlight && (
        <div className={spotlightStyles.spotlightContainer} style={{ position: 'absolute', top: isMobile ? 70 : 80, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <input
            autoFocus
            type="text"
            placeholder="ノード名で検索..."
            value={search}
            onChange={e => onChangeSearch(e.target.value)}
            className={spotlightStyles.searchInput}
          />
          <div className={spotlightStyles.controls}>
            <button className={spotlightStyles.controlButton} onClick={onPrev} disabled={hitsCount === 0}>＜</button>
            <span>{hitsCount > 0 ? `${currentIndex + 1} / ${hitsCount}` : '該当なし'}</span>
            <button className={spotlightStyles.controlButton} onClick={onNext} disabled={hitsCount === 0}>＞</button>
            <button className={spotlightStyles.closeButton} onClick={onCloseSpotlight}>閉じる</button>
          </div>
          {search && hitsCount > 0 && (
            <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', borderTop: 'none', borderRadius: '0 0 8px 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto', margin: 0, padding: 0, zIndex: 101, listStyle: 'none' }}>
              {results.map((r, i) => (
                <li
                  key={r.id}
                  style={{ padding: '8px 16px', background: i === currentIndex ? '#e3f2fd' : '#fff', color: '#333', cursor: 'pointer', borderBottom: '1px solid #eee', fontWeight: i === currentIndex ? 'bold' : 'normal' }}
                  onMouseDown={() => onPickResult(r.id, i)}
                >{r.name}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* agencies filter */}
      {agencies && visibleAgencies && onToggleAgency && (
        <div style={isMobile ? {
          position: 'absolute', bottom: 10, right: 10, zIndex: 30, background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '6px 6px', maxHeight: '30vh', overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 13, minWidth: 90
        } : {
          position: 'absolute', bottom: 30, right: 40, zIndex: 30, background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', maxHeight: '50vh', overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 14, minWidth: 120
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: isMobile ? 13 : 14 }}>省庁表示切替</div>
          {agencies.map((agency) => (
            <label key={agency} style={{ display: 'block', marginBottom: 2, fontSize: isMobile ? 13 : 14 }}>
              <input
                type="checkbox"
                checked={visibleAgencies.includes(agency)}
                onChange={e => onToggleAgency(agency, e.target.checked)}
                style={{ marginRight: 4 }}
              />
              {agency}
            </label>
          ))}
        </div>
      )}
    </>
  );
};

export default Controls;

