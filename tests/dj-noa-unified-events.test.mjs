import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isValidEventDate,
  normalizedEventIdentity,
  linkedRowPatchForEventChange,
  makePlaceholderRow
} from '../src/eventIntegrity.ts';

const event = {
  id: 'event-1', title: 'Feria San Miguel', date: '2026-11-20',
  status: 'confirmed', time: '19:00', showTime: '19:00',
  createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z'
};

test('rejects fabricated dates and uses canonical normalized title + date', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-00-01', '2026-04-31', '2026-2-03', '']) {
    assert.equal(isValidEventDate(date), false, date);
  }
  assert.equal(isValidEventDate('2028-02-29'), true);
  assert.equal(isValidEventDate('2026-02-28'), true);
  assert.equal(
    normalizedEventIdentity('FÉRIA San-Miguel!', event.date),
    normalizedEventIdentity('feria san miguel', event.date)
  );
  assert.notEqual(normalizedEventIdentity(event.title, '2026-11-21'), normalizedEventIdentity(event.title, event.date));
});

test('moving an event updates only linked Excel rows that inherited its date', () => {
  const moved = { ...event, date: '2026-11-21' };
  const row = makePlaceholderRow(event, 'row-1');
  const now = '2026-10-15T00:00:00.000Z';
  assert.deepEqual(linkedRowPatchForEventChange(row, event, moved, now), { calendarDate: moved.date, updatedAt: now });
  assert.equal(
    linkedRowPatchForEventChange({ ...row, calendarDate: '2026-11-05' }, event, moved, now),
    null, 'do not change explicit deposit/payment date'
  );
  assert.deepEqual(
    linkedRowPatchForEventChange({ ...row, calendarDate: undefined }, event, moved, now),
    { calendarDate: moved.date, updatedAt: now }
  );
});

test('renaming event updates generated concept, not real payments or user-edited labels', () => {
  const changed = { ...event, title: 'Nuevo Nombre' };
  const row = makePlaceholderRow(event, 'row-2');
  const now = '2026-10-15T00:00:00.000Z';
  assert.deepEqual(linkedRowPatchForEventChange(row, event, changed, now), { label: 'Nuevo Nombre', updatedAt: now });
  assert.equal(linkedRowPatchForEventChange({ ...row, label: 'Contrato' }, event, changed, now), null);
  assert.equal(linkedRowPatchForEventChange({ ...row, financialType: 'income', amount: 5000 }, event, changed, now), null);
});

test('new blank Excel concept uses eventId, date and neutral zero amount', () => {
  const row = makePlaceholderRow(event, 'row-3');
  assert.equal(row.eventId, event.id);
  assert.equal(row.calendarDate, event.date);
  assert.equal(row.amount, 0);
  assert.equal(row.financialType, 'neutral');
  assert.equal(row.status, 'info');
});

test('app delegates all event writes to central transactional store', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const mut = readFileSync(new URL('../src/eventMutations.ts', import.meta.url), 'utf8');
  assert.match(app, /createEventsWithRelations\(/);
  assert.match(app, /createEventWithRelations\(/);
  assert.match(app, /updateEventWithRelations\(/);
  assert.match(app, /deleteEventWithRelations\(/);
  assert.match(app, /liveQuery\(/);
  assert.doesNotMatch(app, /db\.events\.(add|put|update|delete|bulkAdd|bulkPut)\(/);
  assert.match(mut, /db\.transaction\('rw', \[db\.events, db\.sheetRows\]/);
  assert.match(mut, /db\.transaction\('rw', \[db\.events, db\.eventPhotos, db\.reminders, db\.sheetRows\]/);
});
