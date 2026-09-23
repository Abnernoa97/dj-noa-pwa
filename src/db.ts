import Dexie, { type Table } from 'dexie';
import type { EventItem, HistoryItem, ReminderItem, SheetRow } from './types';

class DJNoaDB extends Dexie {
  events!: Table<EventItem, string>;
  reminders!: Table<ReminderItem, string>;
  sheetRows!: Table<SheetRow, string>;
  history!: Table<HistoryItem, string>;

  constructor() {
    super('dj-noa-local');
    this.version(1).stores({
      events: 'id,date,status,updatedAt',
      reminders: 'id,dueAt,done,eventId,createdAt',
      sheetRows: 'id,category,status,eventId,createdAt',
      history: 'id,createdAt'
    });
  }
}

export const db = new DJNoaDB();
export const uid = () => crypto.randomUUID();
