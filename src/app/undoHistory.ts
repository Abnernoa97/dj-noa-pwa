import type { AssistantMemoryItem } from '../assistantMemory';
import { db } from '../db';
import type { EventItem, ReminderItem, SheetColumn, SheetRow } from '../types';

export type UndoSnapshot = {
  events: EventItem[];
  reminders: ReminderItem[];
  sheetRows: SheetRow[];
  sheetColumns: SheetColumn[];
};

export type StoredHistoryItem = AssistantMemoryItem & {
  id: string;
  createdAt: string;
  undoSnapshot?: UndoSnapshot;
};

export async function captureUndoSnapshot(): Promise<UndoSnapshot> {
  const [events, reminders, sheetRows, sheetColumns] = await Promise.all([
    db.events.toArray(),
    db.reminders.toArray(),
    db.sheetRows.toArray(),
    db.sheetColumns.toArray()
  ]);
  return { events, reminders, sheetRows, sheetColumns };
}

export async function restoreUndoSnapshot(snapshot: UndoSnapshot) {
  await db.transaction('rw', [db.events, db.reminders, db.sheetRows, db.sheetColumns], async () => {
    await Promise.all([db.events.clear(), db.reminders.clear(), db.sheetRows.clear(), db.sheetColumns.clear()]);
    if (snapshot.events.length) await db.events.bulkPut(snapshot.events);
    if (snapshot.reminders.length) await db.reminders.bulkPut(snapshot.reminders);
    if (snapshot.sheetRows.length) await db.sheetRows.bulkPut(snapshot.sheetRows);
    if (snapshot.sheetColumns.length) await db.sheetColumns.bulkPut(snapshot.sheetColumns);
  });
}
