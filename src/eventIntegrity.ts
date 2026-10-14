import type { EventItem, SheetRow } from './types';

/**
 * Pure relationship rules shared by all DJ NOA writers.
 * The event ID is canonical; calendar is a view over events rather than a copy.
 */
export function normalizedEventIdentity(title: string, date: string): string {
  return `${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()}|${date}`;
}

export function isValidEventDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const actual = new Date(Date.UTC(year, month - 1, day));
  return actual.getUTCFullYear() === year && actual.getUTCMonth() === month - 1 && actual.getUTCDate() === day;
}

/** Do not move deposits or payments that have their own explicit dates. */
export function linkedRowPatchForEventChange(
  row: SheetRow,
  previous: Pick<EventItem, 'title' | 'date'>,
  next: Pick<EventItem, 'title' | 'date'>,
  updatedAt: string
): Partial<SheetRow> | null {
  const patch: Partial<SheetRow> = {};
  if (next.date !== previous.date && row.calendarDateSource !== 'manual' &&
      (row.calendarDateSource === 'event' || !row.calendarDate || row.calendarDate === previous.date)) {
    patch.calendarDate = next.date;
  }
  // Change only the automatically generated empty Excel concept. Never rename an
  // actual payment or a custom/independently edited Excel row.
  if (next.title !== previous.title && row.financialType === 'neutral' &&
      row.category === 'Evento' && row.amount === 0 &&
      row.label === previous.title) {
    patch.label = next.title;
  }
  if (!Object.keys(patch).length) return null;
  return { ...patch, updatedAt };
}

export function makePlaceholderRow(event: EventItem, id: string): SheetRow {
  return {
    id,
    label: event.title,
    category: 'Evento',
    amount: 0,
    currency: 'MXN',
    status: 'info',
    financialType: 'neutral',
    eventId: event.id,
    calendarDate: event.date,
    calendarDateSource: 'event',
    values: {},
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
}
