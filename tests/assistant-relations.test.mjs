import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindActionToCreatedEvent,
  createdEventIdFromSummary,
  isMutatingAction
} from '../src/app/assistantActions.ts';

const createdEvent = { id: 'event-ana', date: '2027-10-20' };

test('binds a reminder to the event created in the same command', () => {
  const action = {
    type: 'create_reminder',
    title: 'Confirmar audio',
    eventRef: 'created_event',
    dueAt: '2027-10-18T10:00:00-06:00'
  };
  const bound = bindActionToCreatedEvent(action, createdEvent);
  assert.equal(bound.eventId, 'event-ana');
  assert.equal(bound.eventRef, 'created_event');
});

test('binds an Excel row to the created event and inherits its date', () => {
  const action = {
    type: 'add_sheet_row',
    label: 'Transporte',
    category: 'Inversión',
    amount: 8000,
    eventRef: 'created_event'
  };
  const bound = bindActionToCreatedEvent(action, createdEvent);
  assert.equal(bound.eventId, 'event-ana');
  assert.equal(bound.calendarDate, '2027-10-20');
});

test('preserves an explicit Excel date instead of overwriting it', () => {
  const action = {
    type: 'add_sheet_row',
    label: 'Anticipo',
    category: 'Ganancia',
    amount: 12000,
    calendarDate: '2027-10-01',
    eventRef: 'created_event'
  };
  const bound = bindActionToCreatedEvent(action, createdEvent);
  assert.equal(bound.eventId, 'event-ana');
  assert.equal(bound.calendarDate, '2027-10-01');
});

test('does not attach unrelated actions to a newly created event', () => {
  const action = {
    type: 'add_sheet_row',
    label: 'Publicidad general',
    category: 'Inversión',
    amount: 2000
  };
  assert.deepEqual(bindActionToCreatedEvent(action, createdEvent), action);
});

test('extracts the real created event ID from execution summaries', () => {
  assert.equal(createdEventIdFromSummary('create_event id=abc-123 title="Boda Ana" date=2027-10-20'), 'abc-123');
  assert.equal(createdEventIdFromSummary('update_event id=abc-123'), null);
});

test('relation-producing actions are treated as mutations', () => {
  assert.equal(isMutatingAction({ type: 'create_reminder', title: 'Confirmar audio' }), true);
  assert.equal(isMutatingAction({ type: 'add_sheet_row', label: 'Audio', category: 'Inversión', amount: 5000 }), true);
  assert.equal(isMutatingAction({ type: 'navigate', view: 'calendar' }), false);
});
