import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSheetText, numberValue, behaviorOf } from '../src/domains/sheet/sheetValues.ts';

test('shared Excel input normalization is byte-compatible with the previous three implementations', () => {
  assert.equal(normalizeSheetText('  PÁGO / SÉÑOR 2026!  '), 'pago senor 2026');
  assert.equal(normalizeSheetText('Anticipo'), 'anticipo');
  assert.equal(normalizeSheetText(''), '');
});

test('numeric parsing is unchanged; never invent exchange rates', () => {
  assert.equal(numberValue('$ 1,250'), 1250);
  assert.equal(numberValue(42.75), 42.75);
  assert.equal(numberValue(''), 0);
  assert.equal(numberValue(undefined), 0);
  assert.equal(numberValue(Number.NaN), 0);
  assert.equal(numberValue('n/a'), 0);
});

test('column behavior remains explicit, defaulting to neutral only', () => {
  assert.equal(behaviorOf({ behavior: 'income' }), 'income');
  assert.equal(behaviorOf({ behavior: 'expense' }), 'expense');
  assert.equal(behaviorOf({ behavior: 'investment' }), 'investment');
  assert.equal(behaviorOf({}), 'neutral');
});
