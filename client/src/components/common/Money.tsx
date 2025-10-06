"use client";

import React from 'react';

type MoneyProps = {
  amount: number;
  className?: string;
  style?: React.CSSProperties;
  unitScale?: number; // relative font-size for units (e.g., 0.8)
};

const CHO = 1e12; // 兆
const OKU = 1e8;  // 億
const MAN = 1e4;  // 万

function tokeniseJaYen(n: number): Array<{ text: string; isUnit?: boolean }> {
  if (typeof n !== 'number' || !isFinite(n)) return [{ text: '¥0' }];
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  const toks: Array<{ text: string; isUnit?: boolean }> = [];
  if (sign) toks.push({ text: sign });

  if (abs >= CHO) {
    const cho = Math.floor(abs / CHO);
    const oku = Math.floor((abs % CHO) / OKU);
    toks.push({ text: cho.toLocaleString('ja-JP') });
    toks.push({ text: '兆', isUnit: true });
    if (oku) {
      toks.push({ text: oku.toString() });
      toks.push({ text: '億', isUnit: true });
    }
    toks.push({ text: '円', isUnit: true });
    return toks;
  }
  if (abs >= OKU) {
    const oku = Math.floor(abs / OKU);
    const man = Math.floor((abs % OKU) / MAN);
    toks.push({ text: oku.toString() });
    toks.push({ text: '億', isUnit: true });
    if (man) {
      toks.push({ text: man.toString() });
      toks.push({ text: '万', isUnit: true });
    }
    toks.push({ text: '円', isUnit: true });
    return toks;
  }
  if (abs >= MAN) {
    const man = Math.floor(abs / MAN);
    toks.push({ text: man.toString() });
    toks.push({ text: '万', isUnit: true });
    toks.push({ text: '円', isUnit: true });
    return toks;
  }
  // < 1万円はそのまま円マーク+桁区切り
  toks.push({ text: `¥${Math.round(abs).toLocaleString('ja-JP')}` });
  return toks;
}

const Money: React.FC<MoneyProps> = ({ amount, className, style, unitScale = 0.8 }) => {
  const toks = tokeniseJaYen(amount);
  return (
    <span className={className} style={style}>
      {toks.map((t, i) => t.isUnit ? (
        <span key={i} style={{ fontSize: `${unitScale}em` }}>{t.text}</span>
      ) : (
        <span key={i}>{t.text}</span>
      ))}
    </span>
  );
};

export default Money;

