import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSheetText, numberValue, behaviorOf, makeGridColumnKey } from '../src/domains/sheet/sheetValues.ts';
import { readFileSync } from 'node:fs';

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

test('grid column IDs preserve the exact format for Excel and Noah, with caller-owned UID', () => {
  assert.equal(makeGridColumnKey('Ingreso', 'a1b2c3-more'), 'grid_ingreso_a1b2c3');
  assert.equal(makeGridColumnKey('  MÚSICA / EXTRA 2027! ', '654321-xy'), 'grid_musica_extra_2027_654321');
  assert.equal(makeGridColumnKey('', 'abcdef123'), 'grid_columna_abcdef');
  assert.equal(makeGridColumnKey('!!!', 'A-2_34-any'), 'grid_columna_A-2_34');
});

test('both Excel grid and Noah use the same canonical key builder without local clones', () => {
  const excel = readFileSync(new URL('../src/features/excel/ExcelModulesEnhancer.tsx', import.meta.url), 'utf8');
  const noah = readFileSync(new URL('../src/domains/noah/noahExcel.ts', import.meta.url), 'utf8');
  assert.match(excel, /makeGridColumnKey\('Ingreso', uid\(\)\)/);
  assert.match(excel, /makeGridColumnKey\('Gasto', uid\(\)\)/);
  const owner = readFileSync(new URL('../src/services/storage/sheetColumnMutations.ts', import.meta.url), 'utf8');
  assert.match(owner, /makeGridColumnKey\(trimmed, newId\(\)\)/);
  assert.match(excel, /createGridSheetColumn\(name, newColumnBehavior\)/);
  assert.match(noah, /createGridSheetColumn\(name, action\.behavior \|\| 'neutral'\)/);
  assert.doesNotMatch(excel, /function makeKey\(/);
  assert.doesNotMatch(noah, /function makeColumnKey\(/);
});
