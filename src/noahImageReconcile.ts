import { isValidEventDate, normalizedEventIdentity } from './eventIntegrity.ts';
import type { NoahChatAction } from './noahExcel';
import type { EventItem } from './types';

export type PhotoVisualItem = {
  kind: string;
  title?: string;
  dateISO?: string | null;
  dateText?: string;
  time24?: string;
  timeRole?: string;
  callTime24?: string;
  soundcheckTime24?: string;
  showTime24?: string;
  venue?: string;
  address?: string;
  details?: string;
  evidence?: string;
  confidence?: 'high' | 'medium' | 'low';
  amount?: number;
  currency?: string;
  amountRole?: string;
  paymentStatus?: string;
  eventTitle?: string;
  eventDateISO?: string | null;
};
export type SourceRead = { fileName: string; visualItems: PhotoVisualItem[] };
export type ReviewAction = { action: NoahChatAction; sources: string[]; confidence: 'high' | 'medium' | 'low'; financeSources?: string[] };
export type PhotoConflict = { identity: string; title: string; date: string; fields: string[]; sources: string[] };

export type ReconciledPhotos = {
  actions: ReviewAction[];
  yearless: Array<{ title: string; monthDay: string; showTime?: string; venue?: string; address?: string; notes?: string; confidence: 'high' | 'medium' | 'low'; sources: string[] }>;
  conflicts: PhotoConflict[];
  warnings: string[];
};

const fields = ['showTime', 'callTime', 'soundcheckTime', 'venue', 'address'] as const;
type Field = typeof fields[number];
type Candidate = { title: string; date: string; sources: Set<string>; values: Record<Field, Map<string, Set<string>>>; confidence: 'high' | 'medium' | 'low'; notes: Set<string>; finances: Map<string, Set<string>> };

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function cleanTime(value: unknown) {
  const text = String(value || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : '';
}
function normalizeCurrency(value: unknown) {
  return value === 'MXN' || value === 'USD' ? value : '';
}
function member(item: PhotoVisualItem): Record<Field, string> {
  const role = String(item.timeRole || '').toLowerCase();
  return {
    showTime: cleanTime(item.showTime24) || (role === 'show' ? cleanTime(item.time24) : ''),
    callTime: cleanTime(item.callTime24) || (role === 'call' ? cleanTime(item.time24) : ''),
    soundcheckTime: cleanTime(item.soundcheckTime24) || (role === 'soundcheck' ? cleanTime(item.time24) : ''),
    venue: String(item.venue || '').trim().slice(0, 240),
    address: String(item.address || '').trim().slice(0, 320)
  };
}
function confidenceRank(value: string | undefined) {
  return value === 'low' ? 0 : value === 'medium' ? 1 : 2;
}
function monthDay(value: unknown): string {
  const text = normalize(String(value || ''));
  const months: Record<string, number> = {
    enero: 1, january: 1, jan: 1, feb: 2, febrero: 2, february: 2,
    marzo: 3, march: 3, mar: 3, abril: 4, april: 4, apr: 4,
    mayo: 5, may: 5, junio: 6, june: 6, jun: 6,
    julio: 7, july: 7, jul: 7, agosto: 8, august: 8, aug: 8,
    septiembre: 9, september: 9, sep: 9, sept: 9,
    octubre: 10, october: 10, oct: 10,
    noviembre: 11, november: 11, nov: 11,
    diciembre: 12, december: 12, dec: 12
  };
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  for (let index = 0; index < tokens.length; index++) {
    const month = months[tokens[index]];
    if (!month) continue;
    const preceding = tokens[index - 1] === 'de' || tokens[index - 1] === 'del'
      ? tokens[index - 2] : tokens[index - 1];
    const before = Number(preceding);
    const after = Number(tokens[index + 1]);
    const day = before >= 1 && before <= 31 ? before : after >= 1 && after <= 31 ? after : 0;
    if (day) return String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  const found = text.match(/(?:^|[^\d])(\d{1,2})[\/.-](\d{1,2})(?:[^\d]|$)/);
  if (!found) return '';
  const a = Number(found[1]), b = Number(found[2]);
  // Numeric dates are ambiguous without a locale; never infer order.
  if (a <= 12 && b <= 12) return '';
  if (a > 12 && a <= 31 && b <= 12) return String(b).padStart(2, '0') + '-' + String(a).padStart(2, '0');
  if (b > 12 && b <= 31 && a <= 12) return String(a).padStart(2, '0') + '-' + String(b).padStart(2, '0');
  return '';
}
function updateCandidate(target: Candidate, item: PhotoVisualItem, fileName: string) {
  target.sources.add(fileName);
  if (confidenceRank(item.confidence) < confidenceRank(target.confidence)) target.confidence = item.confidence || 'medium';
  for (const field of fields) {
    const value = member(item)[field];
    if (!value) continue;
    if (!target.values[field].has(value)) target.values[field].set(value, new Set());
    target.values[field].get(value)!.add(fileName);
  }
  const note = String(item.details || '').trim();
  if (note && note.length <= 500) target.notes.add(note);
  // A number becomes a proposal only when it belongs to an explicit event
  // block with a fully stated currency; never guess what "$" means.
  if (typeof item.amount === 'number' && Number.isFinite(item.amount) &&
      item.amount >= 0 && item.amountRole === 'fee' && normalizeCurrency(item.currency)) {
    const key = String(item.amount) + '|' + item.currency;
    if (!target.finances.has(key)) target.finances.set(key, new Set());
    target.finances.get(key)!.add(fileName);
  }
}

/**
 * Deterministic merge. Only identical title + exact full date is accepted as
 * an identity. Partial items may join a unique dated title in this upload.
 * No AI guesses, no fuzzy matching, and never overwrite an existing event.
 */
export function reconcilePhotoReads(reads: SourceRead[], existingEvents: Pick<EventItem, 'title' | 'date'>[]): ReconciledPhotos {
  const warnings: string[] = [];
  const candidates = new Map<string, Candidate>();
  const partial: Array<{ item: PhotoVisualItem; fileName: string }> = [];
  const yearless = new Map<string, ReconciledPhotos['yearless'][number]>();
  for (const read of reads.slice(0, 5)) {
    for (const item of read.visualItems.slice(0, 100)) {
      if (item.kind !== 'event' || !item.title?.trim()) continue;
      const title = item.title.trim();
      const date = String(item.dateISO || '').trim();
      if (!date || !isValidEventDate(date)) {
        partial.push({ item, fileName: read.fileName });
        continue;
      }
      const key = normalizedEventIdentity(title, date);
      if (!candidates.has(key)) candidates.set(key, {
        title, date, sources: new Set(), confidence: 'high', notes: new Set(), finances: new Map(),
        values: { showTime: new Map(), callTime: new Map(), soundcheckTime: new Map(), venue: new Map(), address: new Map() }
      });
      updateCandidate(candidates.get(key)!, item, read.fileName);
    }
  }
  for (const { item, fileName } of partial) {
    const title = item.title!.trim();
    const possible = [...candidates.values()].filter(x => normalize(x.title) === normalize(title));
    const distinctExisting = existingEvents.filter(x => normalize(x.title) === normalize(title) && !possible.some(p => p.date === x.date));
    if (possible.length === 1 && !distinctExisting.length) {
      const statedDay = monthDay(item.dateText);
      if (statedDay && statedDay !== possible[0].date.slice(5)) {
        warnings.push('Fecha contradictoria para “' + title + '” en ' + fileName + '. No uní ese dato al evento.');
      } else {
        updateCandidate(possible[0], item, fileName);
      }
      continue;
    }
    if (possible.length > 1 || distinctExisting.length) {
      warnings.push('El dato de “' + title + '” en ' + fileName + ' no tiene fecha suficiente para asociarlo a un único evento.');
      continue;
    }
    // Only yearless dates with an unambiguous day/month can be proposed.
    const dayMonth = monthDay(item.dateText);
    if (dayMonth) {
      const key = normalize(title) + '|' + dayMonth;
      if (!yearless.has(key)) yearless.set(key, {
        title, monthDay: dayMonth, confidence: item.confidence || 'medium', sources: [],
        showTime: member(item).showTime || undefined, venue: item.venue, address: item.address, notes: item.details
      });
      const entry = yearless.get(key)!;
      if (!entry.sources.includes(fileName)) entry.sources.push(fileName);
    } else {
      warnings.push('“' + title + '” en ' + fileName + ': falta una fecha completa o inequívoca. Solo se muestra para revisión.');
    }
  }
  const actions: ReviewAction[] = [];
  const conflicts: PhotoConflict[] = [];
  const existing = new Set(existingEvents.map(x => normalizedEventIdentity(x.title, x.date)));
  for (const [key, candidate] of candidates) {
    const issues: string[] = [];
    const eventFields: Record<string, string> = {};
    for (const field of fields) {
      const values = [...candidate.values[field].keys()];
      if (values.length > 1) issues.push(field);
      else if (values.length === 1) eventFields[field] = values[0];
    }
    if (candidate.finances.size > 1) issues.push('amount/currency');
    if (issues.length) {
      conflicts.push({ identity: key, title: candidate.title, date: candidate.date, fields: issues, sources: [...candidate.sources] });
      warnings.push('Conflicto en ' + candidate.title + ' (' + candidate.date + '): ' + issues.join(', ') + '. No se guardará automáticamente.');
      continue;
    }
    if (existing.has(key)) {
      warnings.push(candidate.title + ' (' + candidate.date + ') ya existe. No modificaré su información desde fotografías sin una confirmación específica.');
      continue;
    }
    const financeKey = [...candidate.finances.keys()][0];
    const [number, currency] = financeKey ? financeKey.split('|') : [];
    const action: NoahChatAction = {
      type: 'create_event', surface: 'calendar', createExcelConcept: true,
      event: {
        title: candidate.title, date: candidate.date, status: 'confirmed',
        ...(eventFields.showTime ? { showTime: eventFields.showTime } : {}),
        ...(eventFields.callTime ? { callTime: eventFields.callTime } : {}),
        ...(eventFields.soundcheckTime ? { soundcheckTime: eventFields.soundcheckTime } : {}),
        ...(eventFields.venue ? { venue: eventFields.venue } : {}),
        ...(eventFields.address ? { address: eventFields.address } : {}),
        ...(candidate.notes.size ? { notes: [...candidate.notes].join('\n').slice(0, 900) } : {})
      },
      ...(financeKey && normalizeCurrency(currency) ? {
        finance: { amount: Number(number), currency: currency as 'MXN' | 'USD', financialType: 'income' }
      } : {})
    };
    const photoOrder = new Map(reads.map((read, index) => [read.fileName, index]));
    const sources = [...candidate.sources].sort((a, b) => (photoOrder.get(a) ?? 999) - (photoOrder.get(b) ?? 999));
    const financeSources = financeKey
      ? [...(candidate.finances.get(financeKey) || [])].sort((a, b) => (photoOrder.get(a) ?? 999) - (photoOrder.get(b) ?? 999))
      : undefined;
    actions.push({ action, sources, confidence: candidate.confidence, financeSources });
  }
  // Deposits and confirmed payments remain independent dated Excel rows.
  // Never equate a payment's own date with the event's performance date.
  const proposedPayments = new Set<string>();
  for (const read of reads.slice(0, 5)) {
    for (const item of read.visualItems.slice(0, 100)) {
      if (item.kind !== 'payment' || !['deposit', 'payment'].includes(item.amountRole || '')) continue;
      const amount = item.amount;
      const currency = normalizeCurrency(item.currency);
      const date = String(item.dateISO || '');
      const eventDate = String(item.eventDateISO || '');
      const eventTitle = String(item.eventTitle || '').trim();
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 ||
          !currency || !isValidEventDate(date) || !isValidEventDate(eventDate) || !eventTitle) {
        warnings.push('Pago/anticipo en ' + read.fileName + ': falta monto, moneda, fecha propia o referencia completa al evento. No lo guardé.');
        continue;
      }
      const eventKey = normalizedEventIdentity(eventTitle, eventDate);
      if ((!candidates.has(eventKey) || conflicts.some(x => x.identity === eventKey)) && !existing.has(eventKey)) {
        warnings.push('Pago/anticipo en ' + read.fileName + ': no encontré el evento exacto ' + eventTitle + ' (' + eventDate + ').');
        continue;
      }
      const label = item.amountRole === 'deposit' ? 'Anticipo' : 'Pago';
      const paymentKey = [eventKey, label, amount, currency, date].join('|');
      if (proposedPayments.has(paymentKey)) {
        // When multiple screenshots show the same payment, preserve the
        // provenance but propose one movement only.
        const found = actions.find(p => p.action.type === 'create_sheet_row' && (
          [normalizedEventIdentity(p.action.row.eventTitle || '', p.action.row.eventDateISO || ''),
            p.action.row.label, p.action.row.amount, p.action.row.currency, p.action.row.calendarDate].join('|') === paymentKey
        ));
        if (found && !found.sources.includes(read.fileName)) found.sources.push(read.fileName);
        continue;
      }
      proposedPayments.add(paymentKey);
      actions.push({
        action: {
          type: 'create_sheet_row', surface: 'sheet',
          row: {
            eventTitle, eventDateISO: eventDate, calendarDate: date,
            label, category: label, amount, currency: currency as 'MXN' | 'USD',
            financialType: 'income', status: item.paymentStatus === 'paid' ? 'paid' : 'pending',
            description: item.details?.slice(0, 400)
          }
        },
        sources: [read.fileName],
        confidence: item.confidence || 'medium'
      });
    }
  }
  return { actions, yearless: [...yearless.values()], conflicts, warnings };
}
