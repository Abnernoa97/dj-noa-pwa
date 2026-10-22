import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatMoneyBuckets, formatMoneyTotals, groupedExcelTotals, groupedMoney } from '../src/moneyIntegrity.ts';
import { financialSummary } from '../src/finance.ts';

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

test('financial summary groups income and expenses by currency and ignores neutral balances', () => {
  const rows = [
    row('first', 'MXN', {}, 20000, 'income'),
    row('second', 'MXN', {}, 7000, 'expense'),
    row('third', 'USD', {}, 2000, 'income'),
    row('fourth', 'USD', {}, 300, 'expense'),
    row('note', 'USD', {}, 9000, 'neutral'),
  ];
  const result = financialSummary(rows);
  assert.deepEqual(result.MXN, { income: 20000, expense: 7000, neutral: 0, balance: 13000 });
  assert.deepEqual(result.USD, { income: 2000, expense: 300, neutral: 9000, balance: 1700 });
});

test('Excel complement displays USD settlements with historical rows safely locked', () => {
  const sheet = readFileSync(new URL('../src/ExcelModulesEnhancer.tsx', import.meta.url), 'utf8');
  const details = readFileSync(new URL('../src/SheetWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(sheet, /portfolioUsdSettlement\(rows\)/);
  assert.match(sheet, /className="excel-grid-currency"/);
  assert.match(sheet, /summaryValue\(overview\.contracted\)/);
  assert.doesNotMatch(sheet, /money\.format\(totals\.balance\)/);
  assert.match(details, /selectedRow\.currency === 'USD'/);
  assert.match(details, /formatMoneyAmount\(numberValue\(value\), currency\)/);
});
