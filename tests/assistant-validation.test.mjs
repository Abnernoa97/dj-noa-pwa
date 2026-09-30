import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionIsSafe,
  deleteIsConfirmed,
  destructiveConfirmationMessage,
  isDeleteAction
} from '../worker/src/assistant/validation.ts';

function body(history = []) {
  return {
    history,
    context: {
      events: [{ id: 'event-1', title: 'Boda Ana' }],
      reminders: [{ id: 'reminder-1', title: 'Confirmar audio', eventId: 'event-1' }],
      sheetRows: [{ id: 'row-1', label: 'Audio', category: 'Inversión', amount: 8000, eventId: 'event-1' }],
      sheetColumns: [{ id: 'col-1', key: 'custom_comision', name: 'Comisión' }]
    }
  };
}

test('rejects invented IDs for updates and deletions', () => {
  assert.equal(actionIsSafe({ type: 'update_event', eventId: 'event-1', title: 'Boda Ana 2' }, body()), true);
  assert.equal(actionIsSafe({ type: 'update_event', eventId: 'invented', title: 'Boda falsa' }, body()), false);
  assert.equal(actionIsSafe({ type: 'delete_reminder', reminderId: 'invented' }, body()), false);
  assert.equal(actionIsSafe({ type: 'delete_sheet_row', rowId: 'row-1' }, body()), true);
});

test('only accepts declared custom Excel keys', () => {
  assert.equal(actionIsSafe({
    type: 'update_sheet_row',
    rowId: 'row-1',
    values: { custom_comision: 15 }
  }, body()), true);

  assert.equal(actionIsSafe({
    type: 'update_sheet_row',
    rowId: 'row-1',
    values: { custom_inventada: 99 }
  }, body()), false);
});

test('only accepts the explicit created_event reference token', () => {
  assert.equal(actionIsSafe({
    type: 'create_reminder',
    title: 'Confirmar audio',
    eventRef: 'created_event'
  }, body()), true);

  assert.equal(actionIsSafe({
    type: 'create_reminder',
    title: 'Confirmar audio',
    eventRef: 'some_future_event'
  }, body()), false);
});

test('delete requests require confirmation from the same or previous turn', () => {
  assert.equal(deleteIsConfirmed('borra el evento', body()), false);
  assert.equal(deleteIsConfirmed('sí, bórralo', body()), true);

  const withQuestion = body([
    { role: 'assistant', content: 'Voy a eliminar el evento “Boda Ana”. ¿Confirmas?' }
  ]);
  assert.equal(deleteIsConfirmed('sí', withQuestion), true);
  assert.equal(deleteIsConfirmed('adelante', withQuestion), true);
  assert.equal(deleteIsConfirmed('cambia la hora', withQuestion), false);
});

test('destructive confirmation names the real objects from context', () => {
  const actions = [
    { type: 'delete_event', eventId: 'event-1' },
    { type: 'delete_reminder', reminderId: 'reminder-1' },
    { type: 'delete_sheet_row', rowId: 'row-1' }
  ];

  assert.equal(actions.every(isDeleteAction), true);
  const message = destructiveConfirmationMessage(actions, body());
  assert.match(message, /Boda Ana/);
  assert.match(message, /Confirmar audio/);
  assert.match(message, /Audio/);
  assert.match(message, /¿Confirmas\?/);
});
