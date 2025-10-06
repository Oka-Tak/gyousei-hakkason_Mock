export type UnitInfo = {
  kind: 'yen' | 'percent' | 'count' | 'other';
  baseUnit: string; // 表示用の基本単位（円, 人, 件, など）
  convert: (v: number) => number; // 入力値→基本単位への変換
};

function strip(s: string): string { return (s || '').trim(); }

export function normalizeUnit(unitRaw: string): UnitInfo {
  const u = strip(unitRaw);
  if (!u) return { kind: 'other', baseUnit: '', convert: (v) => v };

  // 通貨系
  // 億円/兆円/百万円/千万円/万円/千円/円 を 円 に正規化
  const yenMap: Array<{ pat: RegExp; mul: number }> = [
    { pat: /兆円?$/, mul: 1e12 },
    { pat: /億円?$/, mul: 1e8 },
    { pat: /千万円?$/, mul: 1e7 },
    { pat: /百万円?$/, mul: 1e6 },
    { pat: /万円?$/, mul: 1e4 },
    { pat: /千円?$/, mul: 1e3 },
    { pat: /円$/, mul: 1 },
  ];
  for (const e of yenMap) {
    if (e.pat.test(u)) return { kind: 'yen', baseUnit: '円', convert: (v) => v * e.mul };
  }

  // パーセント系
  if (/％|%|ﾊﾟｰｾﾝﾄ|パーセント/.test(u)) {
    return { kind: 'percent', baseUnit: '%', convert: (v) => v };
  }

  // 件数系（千人/万人 などの千/万接頭辞に対応）
  // 人/件/戸/校/台/施設/団体/世帯/社/箇所/企業/病院 等の末尾単位を抽出
  const countSuffix = /(人|件|戸|校|台|施設|団体|世帯|社|箇所|企業|病院|患者|件数)$/;
  const m = u.match(countSuffix);
  if (m) {
    const base = m[1];
    if (/^千/.test(u)) return { kind: 'count', baseUnit: base, convert: (v) => v * 1_000 };
    if (/^万/.test(u)) return { kind: 'count', baseUnit: base, convert: (v) => v * 10_000 };
    return { kind: 'count', baseUnit: base, convert: (v) => v };
  }

  // その他（指数/点/スコアなど）
  return { kind: 'other', baseUnit: u, convert: (v) => v };
}

export function normalizePercentSeries(values: number[]): { series: number[]; unit: string } {
  // 0..1 が多ければ %にスケール、そうでなければそのまま（%想定）
  const finite = values.filter(v => Number.isFinite(v));
  const max = finite.length ? Math.max(...finite) : 0;
  if (max > 1.0) return { series: values, unit: '%' };
  return { series: values.map(v => v * 100), unit: '%' };
}

