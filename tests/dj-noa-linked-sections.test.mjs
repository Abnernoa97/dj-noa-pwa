import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventScheduleDueAt, eventLinkedReminderPatch } from '../src/eventSchedule.ts';
import { linkedRowPatchForEventChange } from '../src/eventIntegrity.ts';
import { formatMoneyAmount, formatMoneyTotals, groupedMoney } from '../src/moneyIntegrity.ts';

const event = {
  id: 'event-1', title: 'Flora Farms', date: '2026-11-20',
  time: '19:00', showTime: '19:00', callTime: '16:00', soundcheckTime: '17:00',
  status: 'confirmed', createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z'
};

test('event task anchor uses local event date and offset, without UTC day guessing', () => {
  const due = eventScheduleDueAt(event, 'showTime', -60);
  assert.ok(due);
  const date = new Date(due);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 10);
  assert.equal(date.getDate(), 20);
  assert.equal(date.getHours(), 18);
  assert.equal(date.getMinutes(), 0);
  assert.equal(eventScheduleDueAt(event, 'callTime', 0), new Date(2026, 10, 20, 16).toISOString());
  assert.equal(eventScheduleDueAt({ ...event, callTime: undefined }, 'callTime'), null);
  assert.equal(eventScheduleDueAt({ ...event, date: '2026-02-30' }, 'showTime'), null);
  assert.equal(eventScheduleDueAt(event, 'showTime', 100000), null);
});

test('event date and time changes update only explicitly anchored pending reminders', () => {
  const previousDue = eventScheduleDueAt(event, 'showTime', -30);
  const reminder = { id: 'reminder-1', eventId: event.id, title: 'Preparar',
    eventScheduleAnchor: 'showTime', eventScheduleOffsetMinutes: -30,
    dueAt: previousDue, done: false, repeat: 'none', createdAt: '2026-10-14' };
  const nextEvent = { ...event, date: '2026-11-21', showTime: '20:00' };
  const patch = eventLinkedReminderPatch(reminder, event, nextEvent, 'now');
  assert.ok(patch);
  assert.equal(patch.dueAt, new Date(2026, 10, 21, 19, 30).toISOString());
  assert.equal(patch.lastNotifiedAt, undefined);
  assert.equal(eventLinkedReminderPatch({ ...reminder, eventScheduleAnchor: undefined }, event, nextEvent, 'now'), null);
  assert.equal(eventLinkedReminderPatch({ ...reminder, done: true }, event, nextEvent, 'now'), null);
  assert.equal(eventLinkedReminderPatch({ ...reminder, repeat: 'weekly' }, event, nextEvent, 'now'), null);
  assert.equal(eventLinkedReminderPatch({ ...reminder, eventId: 'other' }, event, nextEvent, 'now'), null);
  assert.equal(eventLinkedReminderPatch(reminder, event, { ...nextEvent, showTime: undefined, time: undefined }, 'now'), null);
});

test('manual payment dates stay fixed even when the event moves', () => {
  const previous = { ...event, date: '2026-11-20' };
  const next = { ...previous, date: '2026-11-21' };
  const base = { id: 'r1', eventId: event.id, calendarDate: previous.date,
    label: event.title, category: 'Evento', amount: 1000, currency: 'USD',
    status: 'paid', financialType: 'income', createdAt: 'now' };
  assert.equal(linkedRowPatchForEventChange({ ...base, calendarDateSource: 'manual' }, previous, next, 'now'), null);
  assert.deepEqual(linkedRowPatchForEventChange({ ...base, calendarDateSource: 'event' }, previous, next, 'now'),
    { calendarDate: next.date, updatedAt: 'now' });
});

test('currency sums never merge USD with MXN', () => {
  const rows = [
    { amount: 12000, currency: 'MXN', status: 'pending' },
    { amount: 1500, currency: 'USD', status: 'paid' },
    { amount: 3000, currency: 'MXN', status: 'paid' }
  ];
  assert.deepEqual(groupedMoney(rows), { MXN: 15000, USD: 1500 });
  assert.deepEqual(groupedMoney(rows, ['paid']), { MXN: 3000, USD: 1500 });
  const display = formatMoneyTotals(rows);
  assert.match(display, /15[,\s]?000/);
  assert.match(display, /1[,\s]?500/);
  assert.match(display, /MX/);
  assert.match(display, /US/);
  assert.ok(formatMoneyAmount(1500, 'USD').length > 1);
});

test('calendar, event, excel and home share currency-aware summaries', () => {
  for (const path of ['EventWorkspace.tsx', 'CalendarWorkspace.tsx', 'SheetWorkspace.tsx']) {
    const s = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
    assert.match(s, /formatMoneyTotals\(/, path);
  }
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /formatMoneyTotals\(sheetRows\)/);
  const mut = readFileSync(new URL('../src/eventMutations.ts', import.meta.url), 'utf8');
  assert.match(mut, /eventLinkedReminderPatch\(/);
  assert.match(mut, /db\.transaction\('rw', \[db\.events, db\.sheetRows, db\.reminders\]/);
  const ui = readFileSync(new URL('../src/ReminderWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(ui, /SEGUIR HORARIO DEL EVENTO/);
  assert.match(ui, /eventScheduleDueAt\(/);
  const sheet = readFileSync(new URL('../src/SheetWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(sheet, /Mantener fecha propia/);
  assert.match(sheet, /Moneda/);
});
