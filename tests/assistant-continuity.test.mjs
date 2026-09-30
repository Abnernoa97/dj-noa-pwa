import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationMessages, looksComplex, systemPrompt } from '../worker/src/assistant/prompt.ts';

function baseBody(overrides = {}) {
  return {
    now: '2026-09-30T01:00:00.000Z',
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    history: [],
    uiContext: { view: 'sheet' },
    context: { events: [], reminders: [], sheetRows: [], sheetColumns: [] },
    ...overrides
  };
}

test('routes conversational corrections to the reliable path', () => {
  assert.equal(looksComplex('No, mejor ponlo el viernes a las 7'), true);
  assert.equal(looksComplex('Corrige esa parte y deja solo la hora'), true);
  assert.equal(looksComplex('Eso no, cambia el monto a ocho mil'), true);
});

test('routes chained and long multi-part commands as complex', () => {
  assert.equal(looksComplex('Crea la boda de Ana el 20 de octubre, agrega 8000 de transporte y recuérdame confirmar audio'), true);
  assert.equal(looksComplex('x'.repeat(131)), true);
});

test('keeps only the latest 20 conversation messages and appends the current turn', () => {
  const history = Array.from({ length: 26 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `turn-${index}`
  }));
  const messages = conversationMessages(baseBody({ history }), 'corrige lo anterior');

  assert.equal(messages[0].role, 'system');
  assert.equal(messages.at(-1).role, 'user');
  assert.equal(messages.at(-1).content, 'corrige lo anterior');
  assert.equal(messages.length, 22);
  assert.equal(messages[1].content, 'turn-6');
  assert.equal(messages[20].content, 'turn-25');
});

test('system prompt preserves active event and active Excel row context', () => {
  const prompt = systemPrompt(baseBody({
    uiContext: {
      view: 'sheet',
      activeEventId: 'event-ana',
      activeEventTitle: 'Boda Ana',
      activeEventDate: '2027-10-20',
      activeEventVenue: 'Casa Luna',
      activeSheetRowId: 'row-audio',
      activeSheetRowLabel: 'Audio',
      activeSheetRowCategory: 'Inversión',
      activeSheetRowAmount: 8000,
      activeSheetRowStatus: 'pending',
      activeSheetRowEventId: 'event-ana'
    }
  }));

  assert.match(prompt, /eventoActivo|EVENTO ABIERTO EN PANTALLA/i);
  assert.match(prompt, /event-ana/);
  assert.match(prompt, /Boda Ana/);
  assert.match(prompt, /row-audio/);
  assert.match(prompt, /Audio/);
  assert.match(prompt, /SIEMPRE manda la última decisión explícita/);
  assert.match(prompt, /TODO el historial recibido pertenece a UNA MISMA CONVERSACIÓN continua/);
});
