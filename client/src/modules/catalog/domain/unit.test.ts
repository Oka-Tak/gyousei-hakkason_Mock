import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePercentSeries, normalizeUnit } from './unit';

test('normalizeUnit converts Japanese currency units to yen', () => {
  const unit = normalizeUnit('百万円');
  assert.equal(unit.kind, 'yen');
  assert.equal(unit.baseUnit, '円');
  assert.equal(unit.convert(3), 3_000_000);
});

test('normalizeUnit converts prefixed count units', () => {
  const unit = normalizeUnit('万人');
  assert.equal(unit.kind, 'count');
  assert.equal(unit.baseUnit, '人');
  assert.equal(unit.convert(2), 20_000);
});

test('normalizePercentSeries scales fractional series only', () => {
  assert.deepEqual(normalizePercentSeries([0.1, 0.25]).series, [10, 25]);
  assert.deepEqual(normalizePercentSeries([10, 25]).series, [10, 25]);
});
