import test from 'node:test';
import assert from 'node:assert/strict';
import { expandDeterministicRecurrence } from '../worker/src/deterministicRecurrence.ts';

function basePayload(date = '2027-06-04') {
  return {
    reply: 'Voy a crear las fechas.',
    actions: [{ type: 'create_event', title: 'Evento concretado', date, status: 'confirmed' }]
  };
}

test('expands every Friday and Saturday in June 2027', () => {
  const result = expandDeterministicRecurrence('Agrega todos los viernes y sábados de junio de 2027', basePayload());
  const dates = result.actions.filter((action) => action.type === 'create_event').map((action) => action.date);
  assert.deepEqual(dates, [
    '2027-06-04', '2027-06-05', '2027-06-11', '2027-06-12',
    '2027-06-18', '2027-06-19', '2027-06-25', '2027-06-26'
  ]);
});

test('keeps an isolated date and replaces only the recurring month', () => {
  const payload = {
    reply: 'Plan listo.',
    actions: [
      { type: 'create_event', title: 'Evento concretado', date: '2027-05-24' },
      { type: 'create_event', title: 'Evento concretado', date: '2027-06-04' }
    ]
  };
  const result = expandDeterministicRecurrence('Agrega el 24 de mayo de 2027 y todos los viernes y sábados de junio de 2027', payload);
  const dates = result.actions.filter((action) => action.type === 'create_event').map((action) => action.date);
  assert.equal(dates[0], '2027-05-24');
  assert.equal(dates.length, 9);
  assert.equal(new Set(dates).size, dates.length);
});

test('does not alter non-recurring commands', () => {
  const payload = basePayload('2027-06-04');
  const result = expandDeterministicRecurrence('Agrega un evento el 4 de junio de 2027', payload);
  assert.deepEqual(result, payload);
});

test('weekend phrase maps to Friday and Saturday for DJ NOA planning', () => {
  const result = expandDeterministicRecurrence('Pon todos los fines de semana de enero de 2027', basePayload('2027-01-01'));
  const dates = result.actions.filter((action) => action.type === 'create_event').map((action) => action.date);
  assert.equal(dates.length, 10);
  assert.deepEqual(dates.slice(0, 4), ['2027-01-01', '2027-01-02', '2027-01-08', '2027-01-09']);
});

test('can deterministically expand a long 31-action monthly plan', () => {
  const command = 'Crea Evento concretado todos los lunes, martes, miércoles, jueves, viernes, sábados y domingos de enero de 2027';
  const result = expandDeterministicRecurrence(command, basePayload('2027-01-01'));
  const dates = result.actions.filter((action) => action.type === 'create_event').map((action) => action.date);

  assert.equal(dates.length, 31);
  assert.equal(dates[0], '2027-01-01');
  assert.equal(dates.at(-1), '2027-01-31');
  assert.equal(new Set(dates).size, 31);
});
