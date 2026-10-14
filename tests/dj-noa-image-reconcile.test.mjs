import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcilePhotoReads } from '../src/noahImageReconcile.ts';

const event = (title, dateISO, fields = {}) => ({
  kind: 'event', title, dateISO, dateText: dateISO || '', confidence: 'high', ...fields
});
const read = (fileName, ...visualItems) => ({ fileName, visualItems });

test('joins call time, soundcheck and show from separate photos with identical event identity', () => {
  const merged = reconcilePhotoReads([
    read('agenda.jpg', event('Flora Farms', '2026-11-20', { venue: 'Flora Farms' })),
    read('llamada.jpg', event('Flora Farms', null, { callTime24: '16:00' })),
    read('show.jpg', event('Flora Farms', '2026-11-20', { showTime24: '19:00', soundcheckTime24: '17:00' }))
  ], []);
  assert.equal(merged.actions.length, 1);
  assert.deepEqual(merged.actions[0].sources, ['agenda.jpg', 'llamada.jpg', 'show.jpg']);
  const action = merged.actions[0].action;
  assert.equal(action.type, 'create_event');
  assert.equal(action.event.callTime, '16:00');
  assert.equal(action.event.soundcheckTime, '17:00');
  assert.equal(action.event.showTime, '19:00');
  assert.equal(action.event.date, '2026-11-20');
  assert.equal(action.event.venue, 'Flora Farms');
  assert.deepEqual(merged.conflicts, []);
});

test('never converts a generic hour into show time without a verified label', () => {
  const x = reconcilePhotoReads([
    read('ticket.jpg', event('Festival', '2026-11-20', { time24: '19:00', timeRole: 'unknown' }))
  ], []);
  assert.equal(x.actions.length, 1);
  assert.equal(x.actions[0].action.event.showTime, undefined);
});

test('conflicting show times in two photos block the event, even if both are high confidence', () => {
  const x = reconcilePhotoReads([
    read('one.jpg', event('Flora Farms', '2026-11-20', { showTime24: '19:00' })),
    read('two.jpg', event('Flora Farms', '2026-11-20', { showTime24: '20:00' }))
  ], []);
  assert.equal(x.actions.length, 0);
  assert.equal(x.conflicts.length, 1);
  assert.ok(x.conflicts[0].fields.includes('showTime'));
  assert.deepEqual(x.conflicts[0].sources, ['one.jpg', 'two.jpg']);
});

test('same title with different dates stays as distinct events', () => {
  const x = reconcilePhotoReads([
    read('one.jpg', event('Casa Barcelona', '2026-11-20', { showTime24: '19:00' })),
    read('two.jpg', event('Casa Barcelona', '2026-11-21', { showTime24: '20:00' })),
    read('partial.jpg', event('Casa Barcelona', null, { venue: 'Lugar sin fecha' }))
  ], []);
  assert.equal(x.actions.length, 2);
  assert.ok(x.warnings.some(w => w.includes('fecha suficiente')));
  assert.ok(x.actions.every(a => !a.action.event.venue));
});

test('does not link a partial date that explicitly contradicts a full event date', () => {
  const x = reconcilePhotoReads([
    read('first.jpg', event('Flora Farms', '2026-11-20')),
    read('other.jpg', event('Flora Farms', null, {dateText: '21 de noviembre', showTime24: '23:00'}))
  ], []);
  assert.equal(x.actions.length, 1);
  assert.equal(x.actions[0].action.event.showTime, undefined);
  assert.ok(x.warnings.some(w => w.includes('contradictoria')));
});

test('existing events are never silently modified by new photographs', () => {
  const x = reconcilePhotoReads([
    read('first.jpg', event('Flora Farms', '2026-11-20', {showTime24: '19:00'}))
  ], [{title:'Flora Farms', date:'2026-11-20'}]);
  assert.equal(x.actions.length, 0);
  assert.ok(x.warnings.some(w => w.includes('ya existe')));
});

test('financial values require an explicit currency and incompatible fees are blocked', () => {
  const noCurrency = reconcilePhotoReads([
    read('photo.jpg', event('Flora Farms','2026-11-20',{amount:1000,currency:'$',amountRole:'fee'}))
  ], []);
  assert.equal(noCurrency.actions.length, 1);
  assert.equal(noCurrency.actions[0].action.finance, undefined);

  const withFee = reconcilePhotoReads([
    read('photo.jpg', event('Flora Farms','2026-11-20',{amount:1000,currency:'USD',amountRole:'fee'}))
  ], []);
  assert.equal(withFee.actions[0].action.finance.currency, 'USD');
  assert.equal(withFee.actions[0].action.finance.amount, 1000);

  const incompatible = reconcilePhotoReads([
    read('a.jpg',event('Flora Farms','2026-11-20',{amount:1000,currency:'USD',amountRole:'fee'})),
    read('b.jpg',event('Flora Farms','2026-11-20',{amount:1400,currency:'USD',amountRole:'fee'}))
  ], []);
  assert.equal(incompatible.actions.length, 0);
  assert.ok(incompatible.conflicts[0].fields.includes('amount/currency'));
});

test('unrelated events and low-confidence sources are not automatically merged', () => {
  const x = reconcilePhotoReads([
    read('a.jpg',event('Flora Farms','2026-11-20',{venue:'Flora Farms'})),
    read('b.jpg',event('Prim 30','2026-11-20',{venue:'Prim 30',confidence:'low'}))
  ],[]);
  assert.equal(x.actions.length,2);
  assert.equal(x.actions.find(a=>a.action.event.title==='Prim 30').confidence,'low');
});

test('Noah image UI applies verified cross-photo preview and rechecks duplicates before saving', () => {
  const ui = readFileSync(new URL('../src/NoahImageIntake.tsx',import.meta.url),'utf8');
  const server = readFileSync(new URL('../worker/src/noahImage.ts',import.meta.url),'utf8');
  assert.match(ui, /reconcilePhotoReads\(/);
  assert.match(ui, /currentEvents = await db\.events\.toArray\(\)/);
  assert.match(ui, /Fuentes:/);
  assert.match(ui, /slice\(0, 5\)/);
  assert.match(server, /visualItems,/);
  assert.match(server, /amountRole:/);
});
