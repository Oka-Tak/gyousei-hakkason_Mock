export function formatJaYen(n: number): string {
  if (typeof n !== 'number' || !isFinite(n)) return '¥0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const CHO = 1e12; // 兆
  const OKU = 1e8;  // 億
  const MAN = 1e4;  // 万

  if (abs >= CHO) {
    const cho = Math.floor(abs / CHO);
    const oku = Math.floor((abs % CHO) / OKU);
    return `${sign}${cho}兆${oku ? `${oku}億` : ''}円`;
  }
  if (abs >= OKU) {
    const oku = Math.floor(abs / OKU);
    const man = Math.floor((abs % OKU) / MAN);
    return `${sign}${oku}億${man ? `${man}万` : ''}円`;
  }
  if (abs >= MAN) {
    const man = Math.floor(abs / MAN);
    return `${sign}${man}万円`;
  }
  return `${sign}¥${Math.round(abs).toLocaleString('ja-JP')}`;
}

export function formatPercent(n: number, total: number): string {
  if (!total || !isFinite(n) || !isFinite(total)) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

export function formatCountJa(n: number, unit?: string): string {
  if (typeof n !== 'number' || !isFinite(n)) return unit ? `0${unit}` : '0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const withUnit = (v: string) => unit ? `${v}${unit}` : v;
  const round1 = (x: number) => Math.round(x * 10) / 10;
  if (abs >= 1e8) return sign + withUnit(`${round1(abs / 1e8)}億`);
  if (abs >= 1e4) return sign + withUnit(`${round1(abs / 1e4)}万`);
  if (abs >= 1e3) return sign + withUnit(`${round1(abs / 1e3)}千`);
  return sign + withUnit(`${Math.round(abs).toLocaleString('ja-JP')}`);
}
