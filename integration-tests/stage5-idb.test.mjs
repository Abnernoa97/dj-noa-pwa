import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../src/db.ts';
import { commitNoahVision } from '../../src/noahVisionCommit.ts';

const eventDate = '2026-12-12';
const title = 'Stage 5 IndexedDB Fixture';

function photo(n) {
  return {
    sourceId: 'Foto ' + n,
    file: new File([new Uint8Array([137, 80, 78, 71, n])], 'evidence-' + n + '.png', { type: 'image/png' }),
    rawText: 'Fixture ' + n + ' · solo para la prueba'
  };
}

function eventProposal(sourceIds) {
  return {
    action: { type: 'create_event', surface: 'calendar', event: { title, date: eventDate, status: 'confirmed' } },
    sources: sourceIds, confidence: 'high'
  };
}

async function freshFakeDatabase() {
  await db.delete(); // Only fake-indexeddb exists in this isolated Node test.
  await db.open();
}

for (const count of [1, 2, 3, 4, 5]) {
  test('commits and reopens ' + count + ' original photo(s) atomically', async () => {
    await freshFakeDatabase();
    try {
      const photos = Array.from({ length: count }, (_, index) => photo(index + 1));
      const result = await commitNoahVision([eventProposal(photos.map(x => x.sourceId))], photos);
      assert.equal(result.eventCount, 1);
      assert.equal(result.eventPhotoCount, count);
      assert.equal(await db.events.count(), 1);
      assert.equal(await db.sheetRows.count(), 1, 'placeholder linked to the same event');
      assert.equal(await db.eventPhotos.count(), count);

      db.close();
      await db.open();
      const stored = await db.eventPhotos.toArray();
      assert.equal(stored.length, count);
      for (const item of stored) {
        assert.ok(item.sourceHash?.length === 64);
        assert.ok(item.blob?.size > 0, 'original image must survive reopen');
        assert.ok(item.sourceEvidence?.includes('Fixture'));
        assert.equal(item.eventId, (await db.events.toArray())[0].id);
      }
    } finally {
      await db.delete();
    }
  });
}

test('keeps fee and independently dated deposit in distinct rows, both with evidence', async () => {
  await freshFakeDatabase();
  try {
    const sources = [photo(1), photo(2)];
    const proposals = [{
      ...eventProposal(['Foto 1']),
      financeSources: ['Foto 1'],
      action: {
        type: 'create_event', surface: 'calendar', event: { title, date: eventDate, status: 'confirmed' },
        finance: { amount: 22000, currency: 'MXN', financialType: 'income' }
      }
    }, {
      action: { type: 'create_sheet_row', surface: 'sheet', row: {
        eventTitle: title, eventDateISO: eventDate, calendarDate: '2026-10-17',
        label: 'Anticipo', category: 'Anticipo', amount: 5000, currency: 'MXN', status: 'paid'
      }},
      sources: ['Foto 2'], confidence: 'high'
    }];
    const saved = await commitNoahVision(proposals, sources);
    assert.equal(saved.eventCount, 1);
    assert.equal(saved.movementCount, 1);
    assert.equal(saved.eventPhotoCount, 1);
    assert.equal(saved.paymentPhotoCount, 2);
    const rows = await db.sheetRows.toArray();
    const fee = rows.find(r => r.amount === 22000);
    const deposit = rows.find(r => r.amount === 5000);
    assert.ok(fee && deposit);
    assert.equal(fee.calendarDate, eventDate);
    assert.equal(fee.calendarDateSource, 'event');
    assert.equal(deposit.calendarDate, '2026-10-17');
    assert.equal(deposit.calendarDateSource, 'manual');
    assert.equal(deposit.eventId, fee.eventId);
    const evidence = await db.sheetPhotos.toArray();
    assert.ok(evidence.some(p => p.rowId === fee.id));
    assert.ok(evidence.some(p => p.rowId === deposit.id));
  } finally {
    await db.delete();
  }
});

test('duplicate binary receipt evidence is stored once within a payment row', async () => {
  await freshFakeDatabase();
  try {
    const same = photo(1);
    const renamed = { ...photo(2), file: same.file };
    const proposals = [eventProposal(['Foto 1']), {
      action: { type: 'create_sheet_row', surface: 'sheet', row: {
        eventTitle: title, eventDateISO: eventDate, calendarDate: '2026-10-17',
        label: 'Anticipo', amount: 5000, currency: 'MXN'
      }},
      sources: ['Foto 1', 'Foto 2'], confidence: 'high'
    }];
    const saved = await commitNoahVision(proposals, [same, renamed]);
    assert.equal(saved.paymentPhotoCount, 1);
    assert.equal((await db.sheetPhotos.toArray()).length, 1);
  } finally {
    await db.delete();
  }
});

test('a simulated last-table quota failure rolls back events, movements and evidence', async () => {
  await freshFakeDatabase();
  const original = db.sheetPhotos.bulkAdd;
  try {
    db.sheetPhotos.bulkAdd = async () => {
      throw new DOMException('Simulated IndexedDB quota', 'QuotaExceededError');
    };
    const sources = [photo(1), photo(2)];
    const proposals = [eventProposal(['Foto 1']), {
      action: { type: 'create_sheet_row', surface: 'sheet', row: {
        eventTitle: title, eventDateISO: eventDate, calendarDate: '2026-10-17',
        label: 'Anticipo', amount: 5000, currency: 'MXN'
      }},
      sources: ['Foto 2'], confidence: 'high'
    }];
    await assert.rejects(commitNoahVision(proposals, sources), /quota/i);
    assert.equal(await db.events.count(), 0);
    assert.equal(await db.sheetRows.count(), 0);
    assert.equal(await db.eventPhotos.count(), 0);
    assert.equal(await db.sheetPhotos.count(), 0);
  } finally {
    db.sheetPhotos.bulkAdd = original;
    await db.delete();
  }
});
