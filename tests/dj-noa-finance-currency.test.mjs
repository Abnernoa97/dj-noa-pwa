import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatMoneyBuckets, formatMoneyTotals, groupedExcelTotals, groupedMoney } from '../src/domains/finance/moneyIntegrity.ts';
import { eventUsdSettlement } from '../src/domains/finance/financialOverview.ts';

const col = (name, kind) => ({ id: name, key: name, name, behavior: kind, type: 'currency', position: 0, createdAt: 'now' });
const cols = [col('income', 'income'), col('expense', 'expense'), col('investment', 'investment'), col('note', 'neutral')];
const row = (id, currency, values, amount = 0, financialType = 'neutral') => ({
  id, label: id, category: 'General', amount, currency, status: 'pending',
  financialType, createdAt: 'now', values
});

test('Excel grid totals keep MXN and USD separate in every calculated category', () => {
  const rows = [
    row('mexico', 'MXN', { income: 10000, expense: 2500, investment: 1000, note: 90000 }),
    row('usd', 'USD', { income: 1800, expense: 500, investment: 100, note: 90000 }),
    row('legacy', undefined, { income: 100 }, 0),
  ];
  const result = groupedExcelTotals(rows, cols, (r, c) => r.values[c.key]);
  assert.deepEqual(result.MXN, { income: 10100, expense: 2500, investment: 1000, balance: 6600 });
  assert.deepEqual(result.USD, { income: 1800, expense: 500, investment: 100, balance: 1200 });
  const display = formatMoneyBuckets({ MXN: result.MXN.balance, USD: result.USD.balance });
  assert.doesNotMatch(display, /MXN/);
  assert.match(display, /USD/);
  assert.doesNotMatch(display, /7[,.]?800/);
});

test('legacy rows with no currency explicitly belong to MXN, without altering stored values', () => {
  const rows = [row('legacy', undefined, {}, 7000), row('dollar', 'USD', {}, 1200)];
  assert.deepEqual(groupedMoney(rows), { MXN: 7000, USD: 1200 });
  assert.doesNotMatch(formatMoneyTotals(rows), /MXN/);
  assert.match(formatMoneyTotals(rows), /USD/);
  assert.match(formatMoneyTotals(rows), /histórico/);
});

test('canonical USD settlement counts cash once and excludes unrelated MXN and notes', () => {
  const rows = [
    { ...row('old', 'MXN', {}, 20000, 'income'), financialRole: 'fee' },
    { ...row('fee', 'USD', {}, 2000, 'income'), financialRole: 'fee', syncManaged: true },
    { ...row('advance', 'USD', {}, 300, 'income'), financialRole: 'deposit', status: 'paid' },
    { ...row('note', 'USD', {}, 9000, 'neutral'), financialRole: 'other' }
  ];
  const result = eventUsdSettlement(rows);
  assert.deepEqual(result, { contracted: 2000, received: 300, pending: 1700, hasContract: true, ambiguous: false, excludedLegacy: 1 });
});

test('Excel complement displays USD settlements with historical rows safely locked', () => {
  const sheet = readFileSync(new URL('../src/features/excel/ExcelModulesEnhancer.tsx', import.meta.url), 'utf8');
  const details = readFileSync(new URL('../src/features/excel/SheetWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(sheet, /portfolioUsdSettlement\(rows\)/);
  assert.match(sheet, /className="excel-grid-currency"/);
  assert.match(sheet, /summaryValue\(overview\.contracted\)/);
  assert.doesNotMatch(sheet, /money\.format\(totals\.balance\)/);
  assert.match(details, /selectedRow\.currency === 'USD'/);
  assert.match(details, /formatMoneyAmount\(numberValue\(value\), currency\)/);
});
