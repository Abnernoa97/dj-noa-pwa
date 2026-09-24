import Dexie, { type Table } from 'dexie';
import type { EventItem, HistoryItem, ReminderItem, SheetColumn, SheetPhoto, SheetRow } from './types';

class DJNoaDB extends Dexie {
  events!: Table<EventItem, string>;
  reminders!: Table<ReminderItem, string>;
  sheetRows!: Table<SheetRow, string>;
  sheetColumns!: Table<SheetColumn, string>;
  sheetPhotos!: Table<SheetPhoto, string>;
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
    this.version(3).stores({
      events: 'id,date,status,updatedAt',
      reminders: 'id,dueAt,done,eventId,priority,repeat,updatedAt,createdAt',
      sheetRows: 'id,category,status,eventId,createdAt,updatedAt',
      sheetColumns: 'id,key,position,createdAt',
      history: 'id,createdAt'
    }).upgrade(async (tx) => {
      const reminders = await tx.table('reminders').toArray();
      const now = new Date().toISOString();
      await Promise.all(reminders.map((item) => tx.table('reminders').update(item.id, {
        priority: item.priority || 'normal',
        repeat: item.repeat || 'none',
        notificationEnabled: item.notificationEnabled ?? true,
        updatedAt: item.updatedAt || now
      })));
    });
    this.version(4).stores({
      events: 'id,date,status,updatedAt',
      reminders: 'id,dueAt,done,eventId,priority,repeat,updatedAt,createdAt',
      sheetRows: 'id,category,status,eventId,createdAt,updatedAt',
      sheetColumns: 'id,key,position,createdAt',
      sheetPhotos: 'id,rowId,createdAt',
      history: 'id,createdAt'
    });
    this.version(5).stores({
      events: 'id,date,status,updatedAt',
      reminders: 'id,dueAt,done,eventId,priority,repeat,updatedAt,createdAt',
      sheetRows: 'id,category,status,eventId,calendarDate,createdAt,updatedAt',
      sheetColumns: 'id,key,position,createdAt',
      sheetPhotos: 'id,rowId,createdAt',
      history: 'id,createdAt'
    });
  }
}

export const db = new DJNoaDB();
export const uid = () => crypto.randomUUID();
