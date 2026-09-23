import Dexie, { type Table } from 'dexie';
import type { EventItem, HistoryItem, ReminderItem, SheetColumn, SheetRow } from './types';

class DJNoaDB extends Dexie {
  events!: Table<EventItem, string>;
  reminders!: Table<ReminderItem, string>;
  sheetRows!: Table<SheetRow, string>;
  sheetColumns!: Table<SheetColumn, string>;
  history!: Table<HistoryItem, string>;

  constructor() {
    super('dj-noa-local');
    this.version(1).stores({
      events: 'id,date,status,updatedAt',
      reminders: 'id,dueAt,done,eventId,createdAt',
      sheetRows: 'id,category,status,eventId,createdAt',
      history: 'id,createdAt'
    });
    this.version(2).stores({
      events: 'id,date,status,updatedAt',
      reminders: 'id,dueAt,done,eventId,createdAt',
      sheetRows: 'id,category,status,eventId,createdAt,updatedAt',
      sheetColumns: 'id,key,position,createdAt',
      history: 'id,createdAt'
    }).upgrade(async (tx) => {
      const rows = await tx.table('sheetRows').toArray();
      const now = new Date().toISOString();
      await Promise.all(rows.map((row) => tx.table('sheetRows').update(row.id, { updatedAt: row.updatedAt || now, values: row.values || {} })));
    });
  }
}

export const db = new DJNoaDB();
export const uid = () => crypto.randomUUID();
