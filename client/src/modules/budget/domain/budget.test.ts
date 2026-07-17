import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTotalBudget } from './budget';

test('calculateTotalBudget adds every budget component', () => {
  assert.equal(calculateTotalBudget({
    initial: 100,
    adjustment: -10,
    carryover: 25,
    contingency: 5,
  }), 120);
});

test('calculateTotalBudget treats missing and non-finite values as zero', () => {
  assert.equal(calculateTotalBudget({
    initial: undefined,
    adjustment: null,
    carryover: Number.NaN,
    contingency: 10,
  }), 10);
});
