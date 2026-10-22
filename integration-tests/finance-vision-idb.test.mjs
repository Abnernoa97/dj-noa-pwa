import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db.ts';
import { commitNoahVision } from '../src/noahVisionCommit.ts';

const title = 'Financial Test Event';
const date = '2026-12-12';
const source = (i) => ({
  sourceId: 'Foto ' + i,
  file: new File([Uint8Array.of(137, 80, 78, 71, i)], 'test-' + i + '.png', { type: 'image/png' }),
  rawText: 'Extracted sample ' + i
});
const create = (sources = ['Foto 1']) => ({
  action: { type: 'create_event', surface: 'calendar', event: { title, date, status: 'confirmed' } },
  sources, confidence: 'high'
});
const deposit = (eventTitle = title) => ({
  action: { type: 'create_sheet_row', surface: 'sheet', row: {
    eventTitle, eventDateISO: date, calendarDate: '2026-10-15',
    label: 'Anticipo', category: 'Anticipo', amount: 7000, currency: 'USD', status: 'paid'
  }},
  sources: ['Foto 2'], confidence: 'high'
});
async function fresh() { await db.delete(); await db.open(); }

for (let count = 1; count <= 5; count++) {
  test('Vision parses ' + count + ' file(s) without writing image blobs', async () => {
    await fresh();
    try {
      const files = Array.from({ length: count }, (_, index) => source(index + 1));
      const saved = await commitNoahVision([create(files.map(x => x.sourceId))], files);
      assert.equal(saved.eventCount, 1);
      assert.equal(saved.eventPhotoCount, 0);
      assert.equal(saved.paymentPhotoCount, 0);
      assert.equal(await db.eventPhotos.count(), 0);
      assert.equal(await db.sheetPhotos.count(), 0);
      assert.equal(await db.events.count(), 1);
      assert.equal(await db.sheetRows.count(), 1);
      db.close();
      await db.open();
      assert.equal(await db.events.count(), 1);
      assert.equal(await db.eventPhotos.count(), 0);
    } finally { await db.delete(); }
  });
}

test('Vision saves fee and a USD deposit on its own date, with zero stored images', async () => {
  await fresh();
  try {
    const evt = create();
    evt.action.finance = { amount: 25000, currency: 'USD', financialType: 'income' };
    evt.financeSources = ['Foto 1'];
    const saved = await commitNoahVision([evt, deposit()], [source(1), source(2)]);
    assert.deepEqual(saved, { eventCount: 1, movementCount: 1, eventPhotoCount: 0, paymentPhotoCount: 0 });
    const all = await db.sheetRows.toArray();
    assert.equal(all.length, 2);
    const fee = all.find(x => x.amount === 25000);
    const payment = all.find(x => x.amount === 7000);
    assert.equal(fee?.currency, 'USD');
    assert.equal(payment?.currency, 'USD');
    assert.equal(payment?.calendarDate, '2026-10-15');
    assert.equal(payment?.calendarDateSource, 'manual');
    assert.equal(payment?.eventId, fee?.eventId);
    assert.equal(await db.eventPhotos.count(), 0);
    assert.equal(await db.sheetPhotos.count(), 0);
  } finally { await db.delete(); }
});

test('invalid payment linkage rolls back newly created event and Excel rows', async () => {
  await fresh();
  try {
    await assert.rejects(
      commitNoahVision([create(), deposit('Wrong Event')], [source(1), source(2)]),
      /vision_payment_event_not_found/
    );
    assert.equal(await db.events.count(), 0);
    assert.equal(await db.sheetRows.count(), 0);
  } finally { await db.delete(); }
});

test('manual attachments already in IndexedDB remain intact after a Vision import', async () => {
  await fresh();
  try {
    await db.eventPhotos.add({
      id: 'manual-attachment', eventId: 'existing-event', name: 'manual.jpg',
      type: 'image/jpeg', blob: new Blob(['original'], { type: 'image/jpeg' }), createdAt: 'now'
    });
    await commitNoahVision([create()], [source(1)]);
    assert.equal(await db.eventPhotos.count(), 1);
    assert.equal((await db.eventPhotos.get('manual-attachment'))?.name, 'manual.jpg');
  } finally { await db.delete(); }
});
