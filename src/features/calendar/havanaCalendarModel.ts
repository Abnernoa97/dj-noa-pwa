import type { EventItem, EventStatus } from '../../shared/types';

export type HavanaCalendarTab = 'calendar' | 'events' | 'quotes' | 'summary';
export type HavanaEventFilter = 'upcoming' | 'completed';
export type HavanaQuoteFilter = 'future' | 'past';

export const CALENDAR_STATUS_LABELS: Record<EventStatus, string> = {
  tentative: 'Por concretar',
  confirmed: 'Concretado',
  done: 'Realizado'
};

/** Same three lifecycle groups as HAVANA CALENDARIO, mapped to DJ NOA's
 * existing event statuses. Only local DJ NOA records are accepted as input.
 */
export const isConfirmedEvent = (event: EventItem) => event.status !== 'tentative';
export const isCompletedEvent = (event: EventItem, today: string) =>
  isConfirmedEvent(event) && (event.status === 'done' || event.date < today);

export function calendarCounters(events: EventItem[], today: string) {
  const active = events.filter((event) => !event.trashedAt);
  const confirmed = active.filter(isConfirmedEvent);
  const quotes = active.filter((event) => event.status === 'tentative');
  return {
    events: confirmed.length,
    all: active.length,
    upcoming: confirmed.filter((event) => !isCompletedEvent(event, today)).length,
    completed: confirmed.filter((event) => isCompletedEvent(event, today)).length,
    quotes: quotes.length,
    futureQuotes: quotes.filter((event) => event.date >= today).length,
    pastQuotes: quotes.filter((event) => event.date < today).length
  };
}

/** Calendar lists group year by actual event date, never by creation order. */
export function selectCalendarRecords(
  events: EventItem[],
  tab: Extract<HavanaCalendarTab, 'events' | 'quotes'>,
  filter: HavanaEventFilter | HavanaQuoteFilter,
  today: string
): EventItem[] {
  const items = events.filter((event) => !event.trashedAt).filter((event) => tab === 'events'
    ? isConfirmedEvent(event) && (filter === 'completed' ? isCompletedEvent(event, today) : !isCompletedEvent(event, today))
    : event.status === 'tentative' && (filter === 'past' ? event.date < today : event.date >= today));
  return items.sort((a, b) => {
    const direction = filter === 'completed' || filter === 'past' ? -1 : 1;
    return direction * (a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es'));
  });
}

export function groupCalendarYears(events: EventItem[]): Array<{year: string; events: EventItem[]}> {
  const groups = new Map<string, EventItem[]>();
  for (const event of events) {
    const year = event.date.slice(0, 4);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(event);
  }
  return [...groups].map(([year, items]) => ({year, events:items}));
}

export function selectCalendarDayEvents(events: EventItem[], date: string): EventItem[] {
  return events.filter((event) => !event.trashedAt && event.date === date)
    .sort((a, b) => (a.showTime || a.time || '99:99').localeCompare(b.showTime || b.time || '99:99') ||
      a.title.localeCompare(b.title, 'es'));
}

export const calendarStatusColor = (status: EventStatus, colors: Record<EventStatus, string>) =>
  colors[status];

export const DEFAULT_CALENDAR_COLORS: Record<EventStatus, string> = {
  tentative: '#039BE5',
  confirmed: '#8E24AA',
  done: '#2B916D'
};
