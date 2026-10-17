import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcilePhotoReads } from '../src/noahImageReconcile.ts';
import { hasNoahVisionStorageBudget } from '../src/noahStorageBudget.ts';

const source = (name, ...visualItems) => ({ fileName: name, visualItems });
const evt = () => ({
  kind: 'event', title: 'Stage 5 Evento', dateISO: '2026-12-12',
  confidence: 'high', showTime24: '19:00'
});
const receipt = (status) => ({
  kind: 'payment', title: 'Anticipo', amountRole: 'deposit',
  amount: 5000, currency: 'MXN', dateISO: '2026-10-17',
  eventTitle: 'Stage 5 Evento', eventDateISO: '2026-12-12',
  ...(status ? { paymentStatus: status } : {})
});
const existing = [{ title: 'Stage 5 Evento', date: '2026-12-12' }];

test('one through five source photos reconcile without inventing duplicate events', () => {
  for (let count = 1; count <= 5; count++) {
    const reads = Array.from({ length: count }, (_, index) =>
      source('Foto ' + (index + 1) + ' · same-event.png', evt())
    );
    const result = reconcilePhotoReads(reads, []);
    assert.equal(result.actions.length, 1, 'batch of ' + count);
    assert.equal(result.actions[0].sources.length, count, 'provenance of ' + count);
    assert.equal(result.conflicts.length, 0);
  }
});

test('two screenshots of the same payment with incompatible statuses are blocked', () => {
  const result = reconcilePhotoReads([
    source('Foto 1 · recibo.png', receipt('pending')),
    source('Foto 2 · recibo.png', receipt('paid'))
  ], existing);
  assert.equal(result.actions.length, 0);
  assert.equal(result.conflicts.length, 1);
  assert.ok(result.conflicts[0].fields.includes('paymentStatus'));
  assert.ok(result.warnings.some(w => w.includes('contradictorios')));
});

test('same-status copies remain one payment with two evidence sources', () => {
  const result = reconcilePhotoReads([
    source('Foto 1 · recibo.png', receipt('paid')),
    source('Foto 2 · recibo.png', receipt('paid'))
  ], existing);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].action.type, 'create_sheet_row');
  assert.equal(result.actions[0].action.row.status, 'paid');
  assert.equal(result.actions[0].action.row.calendarDate, '2026-10-17');
  assert.deepEqual(result.actions[0].sources, ['Foto 1 · recibo.png', 'Foto 2 · recibo.png']);
});

test('explicit paid status corrects unknown status, never silently converts paid into pending', () => {
  const result = reconcilePhotoReads([
    source('Foto 1', receipt(undefined)),
    source('Foto 2', receipt('paid'))
  ], existing);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].action.row.status, 'paid');
});

test('storage preflight blocks a clearly insufficient estimate, without assuming unknown quota', () => {
  const MiB = 1024 * 1024;
  assert.equal(hasNoahVisionStorageBudget(10 * MiB, { quota: 20 * MiB, usage: 3 * MiB }), false);
  assert.equal(hasNoahVisionStorageBudget(10 * MiB, { quota: 100 * MiB, usage: 3 * MiB }), true);
  assert.equal(hasNoahVisionStorageBudget(10 * MiB, {}), true);
  assert.equal(hasNoahVisionStorageBudget(-1, {}), false);
});

test('commit keeps one transaction and SHA-256 deduplication for evidence in the same movement', () => {
  const commit = readFileSync(new URL('../src/noahVisionCommit.ts', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/NoahImageIntake.tsx', import.meta.url), 'utf8');
  assert.match(commit, /db\.transaction\('rw', \[db\.events, db\.sheetRows, db\.eventPhotos, db\.sheetPhotos\]/);
  assert.match(commit, /const sheetPhotoHashes = new Map/);
  assert.match(commit, /if \(hashes\.has\(source\.hash\)\) return/);
  assert.match(commit, /await assertNoahVisionStorageCapacity\(estimatedBytes\)/);
  assert.match(app, /try \{ await refresh\(\); \} catch/);
  assert.match(ui, /QuotaExceededError/);
});
