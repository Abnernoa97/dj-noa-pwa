import { addDays, format } from 'date-fns';
import type { AssistantResponse, AppView, EventItem, ReminderItem, SheetRow } from './types';

type Context = { events: EventItem[]; reminders: ReminderItem[]; sheetRows: SheetRow[] };

const viewWords: Array<[RegExp, AppView]> = [
  [/(eventos|agenda de eventos)/i, 'events'],
  [/calendario/i, 'calendar'],
  [/(excel|tabla|gastos)/i, 'sheet'],
  [/(recordatorios|tareas)/i, 'reminders'],
  [/(inicio|home)/i, 'home']
];

function parseDate(command: string): string | undefined {
  const lower = command.toLowerCase();
  if (/\bmañana\b/.test(lower)) return format(addDays(new Date(), 1), 'yyyy-MM-dd');
  if (/\bhoy\b/.test(lower)) return format(new Date(), 'yyyy-MM-dd');
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

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
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
    const candidates = [event.title, event.venue || '', event.address || ''].filter(Boolean);
    for (const candidate of candidates) {
      const clean = normalize(candidate);
      if (clean && haystack.includes(clean)) score += clean.length + 20;
      for (const token of clean.split(' ')) if (token.length > 3 && haystack.includes(token)) score += token.length;
    }
    if (!best || score > best.score) best = { event, score };
  }
  return best && best.score > 0 ? best.event : undefined;
}

function extractAfter(command: string, label: RegExp): string | undefined {
  const match = command.match(label);
  return match?.[1]?.trim().replace(/[.,;]+$/, '') || undefined;
}

function localFallback(command: string, context: Context): AssistantResponse {
  for (const [pattern, view] of viewWords) {
    if (/^(abre|ve a|mu[eé]strame|muestra|ir a)/i.test(command) && pattern.test(command)) {
      const names: Record<AppView, string> = { home: 'inicio', events: 'eventos', calendar: 'calendario', sheet: 'Excel', reminders: 'recordatorios' };
      return { reply: `Abriendo ${names[view]}.`, actions: [{ type: 'navigate', view }] };
    }
  }

  if (/(cu[aá]nto|total|suma).*(excel|tabla|gastos|registrado)/i.test(command)) {
    const total = context.sheetRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { reply: `El total registrado es $${total.toLocaleString('es-MX')}.`, actions: [{ type: 'query_total' }] };
  }

  const amountMatch = command.match(/(?:agrega|añade|registra|pon)\s+(?:\$\s*)?([\d.,]+)\s*(?:pesos|mxn)?\s+(?:de|en|para)?\s*(.*)/i);
  if (amountMatch && /(excel|gasto|transporte|hotel|vuelo|audio|pago|anticipo|saldo|comida|renta)/i.test(command)) {
    const amount = Number(amountMatch[1].replace(/,/g, ''));
    const detail = amountMatch[2].replace(/\b(al|a la|en el|en la)?\s*(excel|tabla)\b/gi, '').trim() || 'Movimiento';
    if (Number.isFinite(amount)) {
      return { reply: `Listo. Agregué $${amount.toLocaleString('es-MX')} a la tabla.`, actions: [{ type: 'add_sheet_row', label: detail, category: detail.split(' ')[0] || 'General', amount, status: 'pending' }] };
    }
  }

  if (/\b(recu[eé]rdame|recordatorio)\b/i.test(command)) {
    const title = command.replace(/^.*?(recu[eé]rdame|recordatorio)\s+(que\s+)?/i, '').trim();
    return { reply: title ? `Recordatorio creado: ${title}.` : 'Dime qué quieres recordar.', actions: title ? [{ type: 'create_reminder', title }] : [{ type: 'none', message: 'Falta el texto del recordatorio.' }] };
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
        body: JSON.stringify({ command, now: new Date().toISOString(), context: { events: context.events.slice(0, 30), reminders: context.reminders.slice(0, 30), sheetRows: context.sheetRows.slice(0, 60) } })
      });
      if (response.ok) return (await response.json()) as AssistantResponse;
    } catch {
      // Keep working locally if the Worker or internet is unavailable.
    }
  }
  return localFallback(command, context);
}
