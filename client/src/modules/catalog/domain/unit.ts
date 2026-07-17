type UnitKind = 'yen' | 'percent' | 'count' | 'other';

export interface UnitInfo {
  kind: UnitKind;
  baseUnit: string;
  convert: (value: number) => number;
}

export function normalizeUnit(unitRaw: string): UnitInfo {
  const unit = unitRaw.trim();
  if (!unit) return { kind: 'other', baseUnit: '', convert: (value) => value };

  const yenUnits: Array<{ pattern: RegExp; multiplier: number }> = [
    { pattern: /兆円?$/, multiplier: 1e12 },
    { pattern: /億円?$/, multiplier: 1e8 },
    { pattern: /千万円?$/, multiplier: 1e7 },
    { pattern: /百万円?$/, multiplier: 1e6 },
    { pattern: /万円?$/, multiplier: 1e4 },
    { pattern: /千円?$/, multiplier: 1e3 },
    { pattern: /円$/, multiplier: 1 },
  ];
  for (const { pattern, multiplier } of yenUnits) {
    if (pattern.test(unit)) {
      return { kind: 'yen', baseUnit: '円', convert: (value) => value * multiplier };
    }
  }

  if (/％|%|ﾊﾟｰｾﾝﾄ|パーセント/.test(unit)) {
    return { kind: 'percent', baseUnit: '%', convert: (value) => value };
  }

  const countMatch = unit.match(/(人|件|戸|校|台|施設|団体|世帯|社|箇所|企業|病院|患者|件数)$/);
  if (countMatch) {
    const baseUnit = countMatch[1];
    if (unit.startsWith('千')) {
      return { kind: 'count', baseUnit, convert: (value) => value * 1_000 };
    }
    if (unit.startsWith('万')) {
      return { kind: 'count', baseUnit, convert: (value) => value * 10_000 };
    }
    return { kind: 'count', baseUnit, convert: (value) => value };
  }

  return { kind: 'other', baseUnit: unit, convert: (value) => value };
}

export function normalizePercentSeries(values: readonly number[]): { series: number[]; unit: '%' } {
  const finiteValues = values.filter(Number.isFinite);
  const max = finiteValues.length ? Math.max(...finiteValues) : 0;
  return {
    series: max > 1 ? [...values] : values.map((value) => value * 100),
    unit: '%',
  };
}
