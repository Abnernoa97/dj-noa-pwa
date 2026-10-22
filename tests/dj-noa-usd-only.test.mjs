import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventUsdSettlement, portfolioUsdSettlement } from '../src/financialOverview.ts';
import { formatMoneyAmount, formatMoneyTotals } from '../src/moneyIntegrity.ts';
import { reconcilePhotoReads } from '../src/noahImageReconcile.ts';

function record(id, amount, role, status = 'pending', currency = 'USD', eventId = 'event-1') {
  return { id, eventId, label: role || 'General', category: role || 'General',
    amount, currency, financialRole: role, status, financialType: 'income',
    createdAt: 'now' };
}

test('USD-only contract math never adds advance to the contractual fee', () => {
  const rows = [
    record('fee', 15000, 'fee'),
    record('advance', 4000, 'deposit', 'paid'),
    record('later', 3500, 'payment', 'pending')
  ];
  const result = eventUsdSettlement(rows);
  assert.deepEqual({ contracted: result.contracted, received: result.received, pending: result.pending },
    { contracted: 15000, received: 4000, pending: 11000 });
  assert.equal(portfolioUsdSettlement(rows).contracted, 15000);
});

test('marking the fee paid cannot add paid deposits again', () => {
  const rows = [
    record('fee', 15000, 'fee', 'paid'),
    record('advance', 4000, 'deposit', 'paid'),
    record('balance', 11000, 'payment', 'paid')
  ];
  const actual = eventUsdSettlement(rows);
  assert.equal(actual.contracted, 15000);
  assert.equal(actual.received, 15000);
  assert.equal(actual.pending, 0);
});

test('ambiguous multiple contract totals never appear as a trustworthy balance', () => {
  const rows = [record('fee1', 15000, 'fee'), record('fee2', 20000, 'fee')];
  const total = portfolioUsdSettlement(rows);
  assert.equal(total.contracted, null);
  assert.equal(total.pending, null);
  assert.equal(total.ambiguous, true);
});

test('old amounts are excluded without currency conversion or deleting the original values', () => {
  const old = record('old', 99000, 'deposit', 'paid', 'MXN');
  const noCurrency = record('unknown', 5000, 'fee', 'pending', undefined);
  noCurrency.currency = undefined;
  const usd = record('fee', 15000, 'fee');
  const records = [old, noCurrency, usd];
  assert.equal(eventUsdSettlement(records).contracted, 15000);
  assert.equal(eventUsdSettlement(records).excludedLegacy, 2);
  assert.equal(old.amount, 99000);
  assert.equal(noCurrency.amount, 5000);
  assert.match(formatMoneyAmount(old.amount, old.currency), /histórico/);
  assert.doesNotMatch(formatMoneyTotals(records), /MXN|99,?000/);
});

test('payment documents denominated outside USD cannot create an expense/deposit', () => {
  const x = reconcilePhotoReads([{
    fileName: 'receipt.jpg', visualItems: [{
      kind: 'payment', title: 'Anticipo', amountRole: 'deposit', amount: 9000,
      currency: 'MXN', dateISO: '2026-10-20', eventTitle: 'Wedding', eventDateISO: '2026-12-12',
      confidence: 'high', paymentStatus: 'paid'
    }]
  }], [{ title: 'Wedding', date: '2026-12-12' }]);
  assert.equal(x.actions.length, 0);
  assert.match(x.warnings.join(' '), /USD|conversión/);
});

test('new money writers and Excel import are USD-only and do not mutate historical records', () => {
  const main = readFileSync(new URL('../src/SheetWorkspace.tsx', import.meta.url), 'utf8');
  const excel = readFileSync(new URL('../src/ExcelModulesEnhancer.tsx', import.meta.url), 'utf8');
  const assistant = readFileSync(new URL('../src/noahExcel.ts', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../worker/src/noahChat.ts', import.meta.url), 'utf8');
  assert.match(main, /currency: 'USD'/);
  assert.match(main, /Moneda = USD/);
  assert.match(main, /selectedRow\.currency === 'USD'/);
  assert.match(excel, /currency: 'USD'/);
  assert.match(excel, /row\.currency !== 'USD'/);
  assert.match(assistant, /if \(row\.currency !== 'USD'\) continue/);
  assert.match(worker, /opera exclusivamente en USD/);
});
