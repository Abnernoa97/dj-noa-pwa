import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeText } from '../src/shared/normalizeText.ts';
import { normalizeSheetText } from '../src/domains/sheet/sheetValues.ts';

test('finance, Excel and Noah share one accent-insensitive normalizer without conversion', () => {
  for (const [input, expected] of [
    ['Anticipo', 'anticipo'],
    ['  GANANCIA $ 1,250 ', 'ganancia 1 250'],
    ['PÁGÓ / SÉÑOR', 'pago senor'],
    ['COSTO—ÉXTRA!', 'costo extra'],
    ['Honorarios', 'honorarios'],
    ['Transporte', 'transporte'],
    ['', '']
  ]) {
    assert.equal(normalizeText(input), expected);
    assert.equal(normalizeSheetText(input), expected);
  }
});

test('older normalization implementations cannot creep back into audited modules', () => {
  for (const path of [
    '../src/domains/finance/financialOverview.ts', '../src/domains/noah/noahImageReconcile.ts',
    '../src/domains/sheet/sheetValues.ts'
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /function normalize\(/, path);
    assert.doesNotMatch(source, /\.normalize\('NFD'\)/, path);
    assert.match(source, /shared\/normalizeText\.ts/, path);
  }
});
