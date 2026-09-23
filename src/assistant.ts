import { addDays, format } from 'date-fns';
import type { AssistantResponse, AppView, EventItem, ReminderItem, ReminderPriority, ReminderRepeat, SheetRow, SheetStatus } from './types';

type Context = { events: EventItem[]; reminders: ReminderItem[]; sheetRows: SheetRow[] };

const viewWords: Array<[RegExp, AppView]> = [
  [/(eventos|agenda de eventos)/i, 'events'],
  [/calendario/i, 'calendar'],
  [/(excel|tabla|gastos)/i, 'sheet'],
  [/(recordatorios|tareas)/i, 'reminders'],
  [/(inicio|home)/i, 'home']
];

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDate(command: string): string | undefined {
  const lower = command.toLowerCase();
  if (/\bpasado mañana\b/.test(lower)) return format(addDays(new Date(), 2), 'yyyy-MM-dd');
  if (/\bmañana\b/.test(lower)) return format(addDays(new Date(), 1), 'yyyy-MM-dd');
  if (/\bhoy\b/.test(lower)) return format(new Date(), 'yyyy-MM-dd');
  const inDays = command.match(/\ben\s+(\d{1,2})\s+d[ií]as?\b/i);
  if (inDays) return format(addDays(new Date(), Number(inDays[1])), 'yyyy-MM-dd');
  const iso = command.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const latin = command.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);
  if (!latin) return undefined;
  const [, d, m, y] = latin;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseTime(command: string): string | undefined {
  const exact = command.match(/\b(?:a\s+las\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if (exact) return `${exact[1].padStart(2, '0')}:${exact[2]}`;
  const simple = command.match(/\ba\s+las\s+(\d{1,2})(?:\s*(am|pm))?\b/i);
  if (!simple) return undefined;
  let hour = Number(simple[1]);
  const suffix = simple[2]?.toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (hour > 23) return undefined;
  return `${String(hour).padStart(2, '0')}:00`;
}

function parseDueAt(command: string): string | undefined {
  const date = parseDate(command);
  const time = parseTime(command);
  if (!date && !time) return undefined;
  const day = date || format(new Date(), 'yyyy-MM-dd');
  return new Date(`${day}T${time || '09:00'}:00`).toISOString();
}

function parseAmount(value: string) {
  const number = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? number : undefined;
}

function findEvent(command: string, context: Context): EventItem | undefined {
  const sorted = [...context.events].sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`));
  if (/\b(pr[oó]ximo|siguiente)\s+evento\b/i.test(command)) {
    const today = format(new Date(), 'yyyy-MM-dd');
    return sorted.find((event) => event.date >= today) || sorted[0];
  }
  if (context.events.length === 1) return context.events[0];
  const haystack = normalize(command);
  let best: { event: EventItem; score: number } | undefined;
  for (const event of context.events) {
    let score = 0;
    for (const candidate of [event.title, event.venue || '', event.address || ''].filter(Boolean)) {
      const clean = normalize(candidate);
      if (clean && haystack.includes(clean)) score += clean.length + 20;
      for (const token of clean.split(' ')) if (token.length > 3 && haystack.includes(token)) score += token.length;
    }
    if (!best || score > best.score) best = { event, score };
  }
  return best && best.score > 0 ? best.event : undefined;
}

function findReminder(command: string, context: Context): ReminderItem | undefined {
  if (!context.reminders.length) return undefined;
  const haystack = normalize(command);
  let best: { reminder: ReminderItem; score: number } | undefined;
  for (const reminder of context.reminders) {
    let score = 0;
    for (const candidate of [reminder.title, reminder.notes || '']) {
      const clean = normalize(candidate);
      if (clean && haystack.includes(clean)) score += clean.length + 20;
      for (const token of clean.split(' ')) if (token.length > 3 && haystack.includes(token)) score += token.length;
    }
    if (!best || score > best.score) best = { reminder, score };
  }
  return best && best.score > 0 ? best.reminder : context.reminders.length === 1 ? context.reminders[0] : undefined;
}

function findSheetRow(command: string, context: Context): SheetRow | undefined {
  if (!context.sheetRows.length) return undefined;
  const haystack = normalize(command);
  let best: { row: SheetRow; score: number } | undefined;
  for (const row of context.sheetRows) {
    let score = 0;
    for (const candidate of [row.label, row.category, row.notes || '']) {
      const clean = normalize(candidate);
      if (clean && haystack.includes(clean)) score += clean.length + 20;
      for (const token of clean.split(' ')) if (token.length > 3 && haystack.includes(token)) score += token.length;
    }
    if (!best || score > best.score) best = { row, score };
  }
  return best && best.score > 0 ? best.row : context.sheetRows.length === 1 ? context.sheetRows[0] : undefined;
}

function extractAfter(command: string, label: RegExp): string | undefined {
  const match = command.match(label);
  return match?.[1]?.trim().replace(/[.,;]+$/, '') || undefined;
}

function reminderPriority(command: string): ReminderPriority | undefined {
  if (/\b(urgente|alta prioridad|prioridad alta|muy importante)\b/i.test(command)) return 'high';
  if (/\b(baja prioridad|prioridad baja)\b/i.test(command)) return 'low';
  if (/\b(prioridad normal|normal)\b/i.test(command)) return 'normal';
  return undefined;
}

function reminderRepeat(command: string): ReminderRepeat | undefined {
  if (/\b(cada d[ií]a|diario|diaria|diariamente)\b/i.test(command)) return 'daily';
  if (/\b(cada semana|semanal|semanalmente)\b/i.test(command)) return 'weekly';
  if (/\b(cada mes|mensual|mensualmente)\b/i.test(command)) return 'monthly';
  if (/\b(no repetir|sin repetir|una sola vez)\b/i.test(command)) return 'none';
  return undefined;
}

function cleanReminderTitle(command: string) {
  return command
    .replace(/^.*?\b(recu[eé]rdame|recordatorio)\b\s*(que\s+)?/i, '')
    .replace(/\b(hoy|mañana|pasado mañana)\b/gi, '')
    .replace(/\ben\s+\d{1,2}\s+d[ií]as?\b/gi, '')
    .replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}\b/g, '')
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, '')
    .replace(/\ba\s+las\s+\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?/gi, '')
    .replace(/\b(cada d[ií]a|diario|diaria|diariamente|cada semana|semanal|semanalmente|cada mes|mensual|mensualmente)\b/gi, '')
    .replace(/\b(urgente|alta prioridad|prioridad alta|baja prioridad|prioridad baja)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function localFallback(command: string, context: Context): AssistantResponse {
  for (const [pattern, view] of viewWords) {
    if (/^(abre|ve a|mu[eé]strame|muestra|ir a)/i.test(command) && pattern.test(command)) {
      const names: Record<AppView, string> = { home: 'inicio', events: 'eventos', calendar: 'calendario', sheet: 'Excel', reminders: 'recordatorios' };
      return { reply: `Abriendo ${names[view]}.`, actions: [{ type: 'navigate', view }] };
    }
  }

  if (/\b(crea|agrega|añade)\b.*\bcolumna\b/i.test(command)) {
    const name = extractAfter(command, /\bcolumna\s+(?:llamada\s+)?([^,;]+?)(?=\s+(?:con\s+f[oó]rmula|tipo)\b|$)/i);
    if (!name) return { reply: 'Dime el nombre de la nueva columna.', actions: [{ type: 'none', message: 'Falta nombre de columna.' }] };
    const formula = extractAfter(command, /(?:con\s+)?f[oó]rmula\s+(.+)$/i);
    const columnType = formula ? 'formula' as const : /\bmoneda\b/i.test(command) ? 'currency' as const : /\bfecha\b/i.test(command) ? 'date' as const : /\bn[uú]mero\b/i.test(command) ? 'number' as const : 'text' as const;
    return { reply: `Creé la columna ${name}.`, actions: [{ type: 'add_sheet_column', name, columnType, formula }] };
  }

  if (/\b(borra|elimina)\b.*\b(gasto|fila|movimiento|registro)\b/i.test(command)) {
    const row = findSheetRow(command, context);
    if (!row) return { reply: 'No encontré qué fila quieres eliminar.', actions: [{ type: 'none', message: 'Fila no identificada.' }] };
    return { reply: `Eliminando ${row.label}.`, actions: [{ type: 'delete_sheet_row', rowId: row.id }] };
  }

  if (/\b(cambia|edita|modifica|actualiza|marca)\b.*\b(gasto|fila|movimiento|registro|transporte|hotel|vuelo|audio|pago|anticipo|saldo|comida|renta)\b/i.test(command)) {
    const row = findSheetRow(command, context);
    if (!row) return { reply: 'No encontré qué fila quieres cambiar.', actions: [{ type: 'none', message: 'Fila no identificada.' }] };
    const amountMatch = command.match(/(?:monto\s+)?(?:a|en)\s+(?:\$\s*)?([\d.,]+)\s*(?:pesos|mxn)?\b/i);
    const amount = amountMatch ? parseAmount(amountMatch[1]) : undefined;
    const status: SheetStatus | undefined = /\b(pagado|pagada|liquidado|liquidada)\b/i.test(command) ? 'paid' : /\b(pendiente)\b/i.test(command) ? 'pending' : /\b(info|informaci[oó]n)\b/i.test(command) ? 'info' : undefined;
    const category = extractAfter(command, /categor[ií]a\s+(?:a|por|es)?\s*([^,;]+)/i);
    const notes = extractAfter(command, /nota(?:s)?\s+(?:a|por|es)?\s*([^;]+)/i);
    if (amount === undefined && !status && !category && !notes) return { reply: 'Dime qué quieres cambiar: monto, estado, categoría o notas.', actions: [{ type: 'none', message: 'Falta el cambio.' }] };
    return { reply: `Listo. Actualicé ${row.label}.`, actions: [{ type: 'update_sheet_row', rowId: row.id, amount, status, category, notes }] };
  }

  if (/(cu[aá]nto|total|suma|gast[eé]).*(excel|tabla|gastos|registrado|transporte|hotel|vuelo|audio|comida|renta)/i.test(command)) {
    const normalized = normalize(command);
    const category = [...new Set(context.sheetRows.map((row) => row.category))].find((item) => normalized.includes(normalize(item)));
    const status: SheetStatus | undefined = /\bpagad[oa]s?\b/i.test(command) ? 'paid' : /\bpendientes?\b/i.test(command) ? 'pending' : undefined;
    const matches = context.sheetRows.filter((row) => (!category || row.category === category) && (!status || row.status === status));
    const total = matches.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const detail = category ? ` en ${category}` : status ? ` ${status === 'paid' ? 'pagado' : 'pendiente'}` : '';
    return { reply: `El total${detail} es $${total.toLocaleString('es-MX')}.`, actions: [{ type: 'query_total', category, status }] };
  }

  const amountMatch = command.match(/(?:agrega|añade|registra|pon)\s+(?:\$\s*)?([\d.,]+)\s*(?:pesos|mxn)?\s+(?:de|en|para)?\s*(.*)/i);
  if (amountMatch && /(excel|gasto|transporte|hotel|vuelo|audio|pago|anticipo|saldo|comida|renta)/i.test(command)) {
    const amount = parseAmount(amountMatch[1]);
    const detail = amountMatch[2].replace(/\b(al|a la|en el|en la)?\s*(excel|tabla)\b/gi, '').trim() || 'Movimiento';
    if (amount !== undefined) return { reply: `Listo. Agregué $${amount.toLocaleString('es-MX')} a la tabla.`, actions: [{ type: 'add_sheet_row', label: detail, category: detail.split(' ')[0] || 'General', amount, status: 'pending' }] };
  }

  if (/\b(borra|elimina)\b.*\b(recordatorio|tarea)\b/i.test(command)) {
    const reminder = findReminder(command, context);
    if (!reminder) return { reply: 'No encontré qué recordatorio quieres eliminar.', actions: [{ type: 'none', message: 'Recordatorio no identificado.' }] };
    return { reply: `Eliminando ${reminder.title}.`, actions: [{ type: 'delete_reminder', reminderId: reminder.id }] };
  }

  if (/\b(cambia|mueve|edita|modifica|actualiza|marca|reabre|repite)\b.*\b(recordatorio|tarea)\b/i.test(command)) {
    const reminder = findReminder(command, context);
    if (!reminder) return { reply: 'No pude identificar el recordatorio.', actions: [{ type: 'none', message: 'Recordatorio no identificado.' }] };
    const dueAt = parseDueAt(command);
    const priority = reminderPriority(command);
    const repeat = reminderRepeat(command);
    const notes = extractAfter(command, /nota(?:s)?\s+(?:a|por|es)?\s*([^;]+)/i);
    const done = /\b(hecho|hecha|completado|completada|terminado|terminada)\b/i.test(command) ? true : /\b(reabre|pendiente otra vez)\b/i.test(command) ? false : undefined;
    const notificationEnabled = /\b(sin notificaciones|desactiva (?:la )?notificaci[oó]n|sin aviso)\b/i.test(command) ? false : /\b(activa (?:la )?notificaci[oó]n|con aviso)\b/i.test(command) ? true : undefined;
    if (!dueAt && !priority && !repeat && !notes && done === undefined && notificationEnabled === undefined) return { reply: 'Dime qué quieres cambiar: fecha, hora, prioridad, repetición, notas o estado.', actions: [{ type: 'none', message: 'Falta el cambio.' }] };
    return { reply: `Listo. Actualicé ${reminder.title}.`, actions: [{ type: 'update_reminder', reminderId: reminder.id, dueAt, priority, repeat, notes, done, notificationEnabled }] };
  }

  if (/\b(recu[eé]rdame|recordatorio)\b/i.test(command)) {
    const title = cleanReminderTitle(command);
    if (!title) return { reply: 'Dime qué quieres recordar.', actions: [{ type: 'none', message: 'Falta el texto del recordatorio.' }] };
    const dueAt = parseDueAt(command);
    const priority = reminderPriority(command) || 'normal';
    const repeat = reminderRepeat(command) || 'none';
    const event = findEvent(command, context);
    const when = dueAt ? ` para ${new Date(dueAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}` : '';
    return { reply: `Recordatorio creado${when}: ${title}.`, actions: [{ type: 'create_reminder', title, dueAt, priority, repeat, eventId: event?.id, notificationEnabled: true }] };
  }

  if (/\b(borra|elimina)\b.*\b(evento|boda|show|fiesta)\b/i.test(command)) {
    const event = findEvent(command, context);
    if (!event) return { reply: 'No encontré qué evento quieres eliminar.', actions: [{ type: 'none', message: 'Evento no identificado.' }] };
    return { reply: `Eliminando ${event.title}.`, actions: [{ type: 'delete_event', eventId: event.id }] };
  }

  if (/\b(cambia|mueve|edita|modifica|actualiza|marca)\b.*\b(evento|boda|show|fiesta)\b/i.test(command) || /\b(pr[oó]ximo|siguiente)\s+evento\b/i.test(command) && /\b(cambia|mueve|edita|modifica|actualiza|marca)\b/i.test(command)) {
    const event = findEvent(command, context);
    if (!event) return { reply: 'No pude identificar el evento que quieres cambiar.', actions: [{ type: 'none', message: 'Evento no identificado.' }] };
    const date = parseDate(command);
    const time = parseTime(command);
    const venue = extractAfter(command, /(?:lugar|venue|sal[oó]n)\s+(?:a|por|es)?\s*([^,;]+)/i);
    const address = extractAfter(command, /direcci[oó]n\s+(?:a|por|es)?\s*([^,;]+)/i);
    const notes = extractAfter(command, /nota(?:s)?\s+(?:a|por|es)?\s*([^;]+)/i);
    const status = /\b(terminado|terminada|hecho|finalizado|finalizada)\b/i.test(command) ? 'done' as const : /\b(tentativo|tentativa|por confirmar)\b/i.test(command) ? 'tentative' as const : /\b(confirmado|confirmada)\b/i.test(command) ? 'confirmed' as const : undefined;
    if (!date && !time && !venue && !address && !notes && !status) return { reply: 'Dime qué quieres cambiar: fecha, hora, lugar, dirección, notas o estado.', actions: [{ type: 'none', message: 'Falta el cambio.' }] };
    return { reply: `Listo. Actualicé ${event.title}.`, actions: [{ type: 'update_event', eventId: event.id, date, time, venue, address, notes, status }] };
  }

  if (/\b(crea|agenda|agrega|añade)\b.*\b(evento|boda|show|fiesta)\b/i.test(command)) {
    const date = parseDate(command);
    const time = parseTime(command);
    const venue = extractAfter(command, /\ben\s+([^,;]+?)(?=\s+(?:el|para)\s+\d|\s+a\s+las\s+|$)/i);
    const title = command.replace(/\b(crea|agenda|agrega|añade)\b/gi, '').replace(/\b(un|una)?\s*(evento|boda|show|fiesta)\b/gi, '').replace(/\b(el|para)\s+\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}\b/gi, '').replace(/\b20\d{2}-\d{2}-\d{2}\b/g, '').replace(/\ba\s+las\s+\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?/gi, '').replace(/\ben\s+.+$/i, '').trim() || 'Evento';
    if (!date) return { reply: 'Necesito la fecha. Puedes decirla como 18/11/2026 o mañana.', actions: [{ type: 'none', message: 'Falta la fecha.' }] };
    return { reply: `Evento creado para ${date}${time ? ` a las ${time}` : ''}.`, actions: [{ type: 'create_event', title, date, time, venue }] };
  }

  return { reply: 'Todavía no puedo resolver ese comando sin conexión. Cuando conectemos el Worker de IA podré interpretar órdenes más libres.', actions: [{ type: 'none', message: 'Comando no reconocido localmente.' }] };
}

export async function askAssistant(command: string, context: Context): Promise<AssistantResponse> {
  const workerUrl = (localStorage.getItem('djnoa.workerUrl') || import.meta.env.VITE_DJNOA_WORKER_URL || '').trim();
  if (workerUrl && navigator.onLine) {
    try {
      const response = await fetch(`${workerUrl.replace(/\/$/, '')}/api/assistant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command, now: new Date().toISOString(), context: { events: context.events.slice(0, 30), reminders: context.reminders.slice(0, 30), sheetRows: context.sheetRows.slice(0, 80) } })
      });
      if (response.ok) return (await response.json()) as AssistantResponse;
    } catch {
      // Local fallback keeps the app useful offline.
    }
  }
  return localFallback(command, context);
}
