import type { ReminderRepeat } from '../../shared/types';
import { addDays, addMonths, addWeeks, parseISO } from 'date-fns';

export function nextReminderOccurrence(dueAt: string, repeat: ReminderRepeat) {
  const current = parseISO(dueAt);
  const next = repeat === 'daily' ? addDays(current, 1) : repeat === 'weekly' ? addWeeks(current, 1) : repeat === 'monthly' ? addMonths(current, 1) : current;
  return next.toISOString();
}

