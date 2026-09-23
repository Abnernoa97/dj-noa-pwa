import type { AssistantResponse, AppView, EventItem, ReminderItem, SheetRow } from './types';

type Context = { events: EventItem[]; reminders: ReminderItem[]; sheetRows: SheetRow[] };

const viewWords: Array<[RegExp, AppView]> = [
  [/calendario/i, 'calendar'],
  [/(excel|tabla|gastos)/i, 'sheet'],
  [/(recordatorios|tareas)/i, 'reminders'],
  [/(inicio|home)/i, 'home']
];

function parseDate(command: string): string | undefined {
  const iso = command.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const latin = command.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);
  if (!latin) return undefined;
  const [, d, m, y] = latin;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function localFallback(command: string, context: Context): AssistantResponse {
  for (const [pattern, view] of viewWords) {
    if (/^(abre|ve a|muéstrame|muestra|ir a)/i.test(command) && pattern.test(command)) {
      return { reply: `Abriendo ${view === 'sheet' ? 'Excel' : view}.`, actions: [{ type: 'navigate', view }] };
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

  if (/\b(crea|agenda|agrega|añade)\b.*\b(evento|boda|show|fiesta)\b/i.test(command)) {
    const date = parseDate(command);
    const title = command.replace(/\b(crea|agenda|agrega|añade)\b/gi, '').replace(/\b(un|una)?\s*(evento|boda|show|fiesta)\b/gi, '').replace(/\b(el|para)\s+\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}\b/gi, '').replace(/\b20\d{2}-\d{2}-\d{2}\b/g, '').trim() || 'Evento';
    if (!date) return { reply: 'Necesito la fecha. Puedes decirla como 18/11/2026.', actions: [{ type: 'none', message: 'Falta la fecha.' }] };
    return { reply: `Evento creado para ${date}.`, actions: [{ type: 'create_event', title, date }] };
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
