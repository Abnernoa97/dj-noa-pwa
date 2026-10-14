import { isValidEventDate } from './eventIntegrity.ts';
import type { EventItem, ReminderItem } from './types';

export type EventScheduleAnchor = 'callTime' | 'soundcheckTime' | 'showTime';
const ANCHORS: EventScheduleAnchor[] = ['callTime', 'soundcheckTime', 'showTime'];

export function isEventScheduleAnchor(value: unknown): value is EventScheduleAnchor {
  return ANCHORS.includes(value as EventScheduleAnchor);
}

/** Dates in DJ NOA are local event dates, NOT UTC calendar days. */
export function eventScheduleDueAt(
  event: Pick<EventItem, 'date' | 'time' | 'callTime' | 'soundcheckTime' | 'showTime'>,
  anchor: EventScheduleAnchor,
  offsetMinutes = 0
): string | null {
  if (!isEventScheduleAnchor(anchor) || !isValidEventDate(event.date)) return null;
  if (!Number.isInteger(offsetMinutes) || offsetMinutes < -1440 || offsetMinutes > 1440) return null;
  const value = anchor === 'showTime' ? event.showTime || event.time : event[anchor];
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [year, month, day] = event.date.split('-').map(Number);
  const [hour, minute] = value.split(':').map(Number);
  const start = new Date(year, month - 1, day, hour, minute, 0, 0);
  // Nonexistent local times (e.g. daylight saving jumps) must be confirmed,
  // never silently normalized into an incorrect time.
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 ||
      start.getDate() !== day || start.getHours() !== hour || start.getMinutes() !== minute) return null;
  start.setMinutes(start.getMinutes() + offsetMinutes);
  return start.toISOString();
}

/** Manually scheduled reminders remain untouched; opt-in event reminders follow. */
export function eventLinkedReminderPatch(
  reminder: ReminderItem,
  previous: EventItem,
  next: EventItem,
  updatedAt: string
): Partial<ReminderItem> | null {
  if (reminder.eventId !== next.id || !reminder.eventScheduleAnchor || reminder.done ||
      reminder.repeat && reminder.repeat !== 'none') return null;
  const anchor = reminder.eventScheduleAnchor;
  const offsetMinutes = reminder.eventScheduleOffsetMinutes ?? 0;
  const previousDue = eventScheduleDueAt(previous, anchor, offsetMinutes);
  const nextDue = eventScheduleDueAt(next, anchor, offsetMinutes);
  if (!nextDue) return null; // Don't overwrite a date when the anchor disappeared.
  if (nextDue === previousDue || nextDue === reminder.dueAt) return null;
  return { dueAt: nextDue, lastNotifiedAt: undefined, updatedAt };
}
