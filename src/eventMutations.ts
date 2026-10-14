import { db, uid } from './db';
import { isValidEventDate, linkedRowPatchForEventChange, makePlaceholderRow, normalizedEventIdentity } from './eventIntegrity';
import { eventLinkedReminderPatch } from './eventSchedule';
import type { NoahFinanceInput } from './noahEvents';
import type { EventItem, ReminderItem, SheetRow } from './types';

export type EventDraftData = Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>;

export type CreateEventOptions = {
  finance?: NoahFinanceInput;
  createExcelConcept?: boolean;
  /** Noah's automatic imports must not silently create duplicate event identities. */
  skipDuplicates?: boolean;
};

function validateEventDraft(draft: EventDraftData) {
  if (!draft.title?.trim() || !isValidEventDate(draft.date)) throw new Error('invalid_event_identity');
  for (const key of ['time', 'showTime', 'callTime', 'soundcheckTime'] as const) {
    const value = draft[key];
    if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('invalid_event_time');
  }
}

function financeValues(event: EventItem, finance: NoahFinanceInput, existing?: SheetRow): Omit<SheetRow, 'id' | 'createdAt'> {
  if (!Number.isFinite(finance.amount) || finance.amount < 0) throw new Error('invalid_finance_amount');
  if (finance.currency !== 'MXN' && finance.currency !== 'USD') throw new Error('invalid_finance_currency');
  return {
    label: finance.label?.trim() || event.title,
    category: finance.category?.trim() || 'Evento',
    amount: finance.amount,
    currency: finance.currency,
    status: finance.status || 'pending',
    financialType: finance.financialType || 'income',
    eventId: event.id,
    calendarDate: event.date,
    calendarDateSource: 'event' as const,
    syncManaged: true,
    notes: finance.notes ?? existing?.notes,
    description: finance.description ?? existing?.description,
    values: existing?.values || {},
    updatedAt: new Date().toISOString()
  };
}

/** One local IndexedDB transaction: create event(s) and related Excel rows together. */
export async function createEventsWithRelations(
  drafts: EventDraftData[],
  options: CreateEventOptions = {}
): Promise<{ created: EventItem[]; sheetRows: SheetRow[]; skipped: number }> {
  if (!drafts.length) return { created: [], sheetRows: [], skipped: 0 };
  drafts.forEach(validateEventDraft);
  const dates = [...new Set(drafts.map((draft) => draft.date))];

  return db.transaction('rw', [db.events, db.sheetRows], async () => {
    const existing = options.skipDuplicates
      ? await db.events.where('date').anyOf(dates).toArray()
      : [];
    const keys = new Set(existing.map((event) => normalizedEventIdentity(event.title, event.date)));
    const created: EventItem[] = [];
    const sheetRows: SheetRow[] = [];
    let skipped = 0;

    for (const draft of drafts) {
      const title = draft.title.trim();
      const identity = normalizedEventIdentity(title, draft.date);
      if (options.skipDuplicates && keys.has(identity)) {
        skipped += 1;
        continue;
      }
      keys.add(identity);
      const now = new Date().toISOString();
      const showTime = draft.showTime ?? draft.time ?? '';
      const event: EventItem = {
        ...draft,
        title,
        time: showTime,
        showTime,
        id: uid(),
        createdAt: now,
        updatedAt: now
      };
      created.push(event);
      if (options.finance) {
        sheetRows.push({
          ...financeValues(event, options.finance),
          id: uid(),
          createdAt: now
        });
      } else if (options.createExcelConcept) {
        sheetRows.push(makePlaceholderRow(event, uid()));
      }
    }
    if (created.length) await db.events.bulkAdd(created);
    if (sheetRows.length) await db.sheetRows.bulkAdd(sheetRows);
    return { created, sheetRows, skipped };
  });
}

export async function createEventWithRelations(
  draft: EventDraftData,
  options: CreateEventOptions = {}
): Promise<{ event: EventItem | null; row: SheetRow | null; skipped: boolean }> {
  const result = await createEventsWithRelations([draft], options);
  return { event: result.created[0] || null, row: result.sheetRows[0] || null, skipped: result.skipped > 0 };
}

/** Updates the canonical event and inherited dates/placeholder labels atomically. */
export async function updateEventWithRelations(
  eventId: string,
  patch: Partial<EventDraftData>
): Promise<EventItem> {
  return db.transaction('rw', [db.events, db.sheetRows, db.reminders], async () => {
    const previous = await db.events.get(eventId);
    if (!previous) throw new Error('event_not_found');
    const next: EventItem = { ...previous, ...patch, id: previous.id, createdAt: previous.createdAt, updatedAt: new Date().toISOString() };
    validateEventDraft(next);
    if (next.showTime !== previous.showTime && patch.time === undefined) next.time = next.showTime;
    else if (patch.time !== undefined && patch.showTime === undefined) next.showTime = next.time;
    await db.events.put(next);

    if (next.date !== previous.date || next.title !== previous.title) {
      const rows = await db.sheetRows.where('eventId').equals(eventId).toArray();
      for (const row of rows) {
        const rowPatch = linkedRowPatchForEventChange(row, previous, next, next.updatedAt);
        if (rowPatch) await db.sheetRows.update(row.id, rowPatch);
      }
    }
    // Every opt-in task follows the canonical event's date/time. Manual
    // deadlines keep their own dates and are never silently rewritten.
    if (next.date !== previous.date || next.time !== previous.time ||
        next.callTime !== previous.callTime || next.soundcheckTime !== previous.soundcheckTime ||
        next.showTime !== previous.showTime) {
      const reminders = await db.reminders.where('eventId').equals(eventId).toArray();
      for (const reminder of reminders) {
        const reminderPatch = eventLinkedReminderPatch(reminder, previous, next, next.updatedAt);
        if (reminderPatch) await db.reminders.update(reminder.id, reminderPatch);
      }
    }
    return next;
  });
}

/** A finance operation updates only an exact unambiguous match or an empty
 * concept; otherwise it creates a separate movement instead of overwriting a deposit.
 */
export async function syncEventFinance(eventId: string, finance: NoahFinanceInput): Promise<SheetRow> {
  return db.transaction('rw', [db.events, db.sheetRows], async () => {
    const event = await db.events.get(eventId);
    if (!event) throw new Error('event_not_found');
    const desired = financeValues(event, finance);
    const rows = await db.sheetRows.where('eventId').equals(eventId).toArray();
    const matches = rows.filter((row) =>
      row.financialType === desired.financialType && row.currency === desired.currency &&
      row.category === desired.category && row.label === desired.label &&
      row.syncManaged === true && row.status !== 'paid'
    );
    if (matches.length > 1) throw new Error('ambiguous_finance_match');
    const existing = matches[0] || rows.find((row) =>
      row.financialType === 'neutral' && row.status === 'info' && row.amount === 0 &&
      row.category === 'Evento' && row.label === event.title && row.syncManaged !== false
    );
    if (existing) {
      // Explicit payments can have their own date; preserve it during financial edits.
      const next = {
        ...desired,
        calendarDate: existing.calendarDateSource === 'manual' ? existing.calendarDate : event.date,
        calendarDateSource: existing.calendarDateSource === 'manual' ? 'manual' as const : 'event' as const,
        values: existing.values || {}
      };
      await db.sheetRows.update(existing.id, next);
      return { ...existing, ...next };
    }
    const row: SheetRow = { ...desired, id: uid(), createdAt: new Date().toISOString() };
    await db.sheetRows.add(row);
    return row;
  });
}

/** If a user adds a concept through Noah, do not duplicate any linked Excel row. */
export async function ensureEventExcelConcept(eventId: string): Promise<SheetRow> {
  return db.transaction('rw', [db.events, db.sheetRows], async () => {
    const event = await db.events.get(eventId);
    if (!event) throw new Error('event_not_found');
    const rows = await db.sheetRows.where('eventId').equals(eventId).toArray();
    if (rows.length) return rows[0];
    const row = makePlaceholderRow(event, uid());
    await db.sheetRows.add(row);
    return row;
  });
}

/** Deleting a calendar event does not destroy a linked payment or reminder:
 * both survive unlinked. Photographs belonging only to that event are removed.
 */
export async function deleteEventWithRelations(eventId: string): Promise<void> {
  await db.transaction('rw', [db.events, db.eventPhotos, db.reminders, db.sheetRows], async () => {
    const event = await db.events.get(eventId);
    if (!event) return;
    const now = new Date().toISOString();
    const reminders: ReminderItem[] = await db.reminders.where('eventId').equals(eventId).toArray();
    const rows: SheetRow[] = await db.sheetRows.where('eventId').equals(eventId).toArray();
    await Promise.all(reminders.map((reminder) => db.reminders.update(reminder.id, { eventId: undefined, eventScheduleAnchor: undefined, eventScheduleOffsetMinutes: undefined, updatedAt: now })));
    await Promise.all(rows.map((row) => db.sheetRows.update(row.id, {
      eventId: undefined,
      calendarDate: row.calendarDate || event.date,
      calendarDateSource: 'manual',
      updatedAt: now
    })));
    await db.eventPhotos.where('eventId').equals(eventId).delete();
    await db.events.delete(eventId);
  });
}
