import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePureTotal } from '../src/assistantTotals.ts';

const now = '2026-09-30T01:00:00.000Z';
const context = {
  events: [],
  reminders: [],
  sheetRows: [
    { id: 'r1', label: 'Anticipo Ana', category: 'Ganancia', amount: 10000, status: 'paid', financialType: 'income', createdAt: now },
    { id: 'r2', label: 'Segundo pago Ana', category: 'Ganancia', amount: 5000, status: 'paid', financialType: 'income', createdAt: now },
    { id: 'r3', label: 'Pago pendiente', category: 'Ganancia', amount: 7000, status: 'pending', financialType: 'income', createdAt: now },
    { id: 'r4', label: 'Audio', category: 'Inversión', amount: 8000, status: 'paid', financialType: 'expense', createdAt: now },
    { id: 'r5', label: 'Nota', category: 'Info', amount: 0, status: 'info', financialType: 'neutral', createdAt: now }
  ]
};

test('calculates category totals deterministically instead of trusting the model reply', () => {
  const result = resolvePureTotal({
    reply: 'El total es cualquier cosa.',
    actions: [{ type: 'query_total', category: 'Ganancia' }]
  }, context);

  assert.match(result.reply, /22,000/);
  assert.match(result.reply, /3 movimientos/);
  assert.deepEqual(result.actions, []);
});

test('filters finance totals by category and payment status', () => {
  const result = resolvePureTotal({
    reply: 'calculando',
    actions: [{ type: 'query_total', category: 'ganancia', status: 'paid' }]
  }, context);

  assert.match(result.reply, /15,000/);
  assert.match(result.reply, /2 movimientos/);
  assert.match(result.reply, /pagado/i);
});

test('normalizes accents and case in finance categories', () => {
  const result = resolvePureTotal({
    reply: 'calculando',
    actions: [{ type: 'query_total', category: 'inversion' }]
  }, context);

  assert.match(result.reply, /8,000/);
  assert.match(result.reply, /1 movimiento/);
});

test('calculates an unfiltered total across all Excel rows', () => {
  const result = resolvePureTotal({
    reply: 'calculando',
    actions: [{ type: 'query_total' }]
  }, context);

  assert.match(result.reply, /30,000/);
  assert.match(result.reply, /5 movimientos/);
});

test('does not resolve query_total early when the same plan still mutates data', () => {
  const response = {
    reply: 'Voy a agregar y luego calcular.',
    actions: [
      { type: 'add_sheet_row', label: 'Nuevo anticipo', category: 'Ganancia', amount: 3000 },
      { type: 'query_total', category: 'Ganancia' }
    ]
  };

  assert.deepEqual(resolvePureTotal(response, context), response);
});
