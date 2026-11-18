import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeText } from '../src/shared/normalizeText.ts';
import { normalizeSheetText } from '../src/domains/sheet/sheetValues.ts';
import { financialTypeForCategory } from '../src/finance.ts';

test('finance, Excel and Noah share one accent-insensitive normalizer without conversion', () => {
  for (const [input, expected] of [
    ['Anticipo', 'anticipo'],
    ['  GANANCIA $ 1,250 ', 'ganancia 1 250'],
    ['PÁGÓ / SÉÑOR', 'pago senor'],
    ['COSTO—ÉXTRA!', 'costo extra'],
    ['', '']
  ]) {
    assert.equal(normalizeText(input), expected);
    assert.equal(normalizeSheetText(input), expected);
  }
  assert.equal(financialTypeForCategory('Honorarios'), 'income');
  assert.equal(financialTypeForCategory('Transporte'), 'expense');
  assert.equal(financialTypeForCategory('Notas'), 'neutral');
});

test('older normalization implementations cannot creep back into audited modules', () => {
  for (const path of [
    '../src/finance.ts', '../src/financialOverview.ts', '../src/domains/noah/noahImageReconcile.ts',
    '../src/domains/sheet/sheetValues.ts'
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /function normalize\(/, path);
    assert.doesNotMatch(source, /\.normalize\('NFD'\)/, path);
    assert.match(source, /shared\/normalizeText\.ts/, path);
  }
});
