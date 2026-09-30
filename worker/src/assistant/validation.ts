import type { RequestBody } from './types';

const allowedActions = new Set([
  'create_event', 'update_event', 'delete_event',
  'create_reminder', 'update_reminder', 'delete_reminder',
  'add_sheet_row', 'update_sheet_row', 'delete_sheet_row',
  'add_sheet_column', 'navigate', 'open_map', 'query_total', 'none'
]);

function idsFrom(items: Record<string, unknown>[] | undefined) {
  return new Set((items || []).map((item) => String(item.id || '')).filter(Boolean));
}

function customKeys(body: RequestBody) {
  return new Set((body.context?.sheetColumns || []).map((item) => String(item.key || '')).filter(Boolean));
}

function valuesAreSafe(value: unknown, body: RequestBody) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const allowed = customKeys(body);
  return Object.keys(value as Record<string, unknown>).every((key) => allowed.has(key));
}

function isIsoDate(value: unknown) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(String(value || ''));
}

function eventRefIsSafe(value: Record<string, unknown>) {
  return value.eventRef === undefined || value.eventRef === 'created_event';
}

export function actionIsSafe(action: unknown, body: RequestBody) {
  if (!action || typeof action !== 'object') return false;
  const value = action as Record<string, unknown>;
  const type = String(value.type || '');
  if (!allowedActions.has(type)) return false;

  const events = idsFrom(body.context?.events);
  const reminders = idsFrom(body.context?.reminders);
  const rows = idsFrom(body.context?.sheetRows);

  if (type === 'create_event') return Boolean(String(value.title || '').trim() && isIsoDate(value.date));
  if (type === 'update_event' || type === 'delete_event' || type === 'open_map') return events.has(String(value.eventId || ''));
  if (type === 'create_reminder') return Boolean(String(value.title || '').trim() && eventRefIsSafe(value));
  if (type === 'update_reminder' || type === 'delete_reminder') return reminders.has(String(value.reminderId || ''));
  if (type === 'add_sheet_row') return Boolean(String(value.label || '').trim() && String(value.category || '').trim() && Number.isFinite(Number(value.amount)) && eventRefIsSafe(value) && valuesAreSafe(value.values, body));
  if (type === 'update_sheet_row') return rows.has(String(value.rowId || '')) && valuesAreSafe(value.values, body);
  if (type === 'delete_sheet_row') return rows.has(String(value.rowId || ''));
  if (type === 'add_sheet_column') return Boolean(String(value.name || '').trim());
  if (type === 'navigate') return ['home', 'events', 'calendar', 'sheet', 'reminders'].includes(String(value.view || ''));
  return true;
}

export function isDeleteAction(action: unknown) {
  if (!action || typeof action !== 'object') return false;
  const type = String((action as Record<string, unknown>).type || '');
  return type === 'delete_event' || type === 'delete_reminder' || type === 'delete_sheet_row';
}

function lastAssistantHistory(body: RequestBody) {
  const history = Array.isArray(body.history) ? body.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (item?.role === 'assistant' && String(item.content || '').trim()) return String(item.content || '');
  }
  return '';
}

export function deleteIsConfirmed(text: string, body: RequestBody) {
  const normalized = text.toLowerCase().trim();
  const explicitSameTurn = /\b(estoy segur[oa]|confirmo(?:\s+la\s+eliminaci[oó]n)?|s[ií],?\s*(?:b[oó]rralo|elim[ií]nalo|hazlo)|elim[ií]nalo definitivamente|b[oó]rralo definitivamente)\b/i.test(normalized);
  if (explicitSameTurn) return true;

  const previousAssistant = lastAssistantHistory(body);
  const askedForConfirmation = /\b(confirmas|confirmar|est[aá]s segur[oa]|seguro que quieres|quieres eliminar|quieres borrar)\b/i.test(previousAssistant);
  const shortConfirmation = /^\s*(s[ií]|confirmo|adelante|hazlo|de acuerdo|ok(?:ay)?|correcto|confirmado)(?:[,.!\s].*)?$/i.test(text);
  return askedForConfirmation && shortConfirmation;
}

function findById(items: Record<string, unknown>[] | undefined, id: string) {
  return (items || []).find((item) => String(item.id || '') === id);
}

function destructiveLabel(action: unknown, body: RequestBody) {
  const value = action as Record<string, unknown>;
  const type = String(value.type || '');
  if (type === 'delete_event') {
    const event = findById(body.context?.events, String(value.eventId || ''));
    return `el evento “${String(event?.title || 'seleccionado')}”`;
  }
  if (type === 'delete_reminder') {
    const reminder = findById(body.context?.reminders, String(value.reminderId || ''));
    return `la tarea “${String(reminder?.title || 'seleccionada')}”`;
  }
  if (type === 'delete_sheet_row') {
    const row = findById(body.context?.sheetRows, String(value.rowId || ''));
    return `la fila de Excel “${String(row?.label || 'seleccionada')}”`;
  }
  return 'ese elemento';
}

export function destructiveConfirmationMessage(actions: unknown[], body: RequestBody) {
  const labels = actions.map((action) => destructiveLabel(action, body));
  if (labels.length === 1) return `Voy a eliminar ${labels[0]}. ¿Confirmas?`;
  const visible = labels.slice(0, 3).join(', ');
  const extra = labels.length > 3 ? ` y ${labels.length - 3} más` : '';
  return `Voy a eliminar ${visible}${extra}. ¿Confirmas?`;
}
