import type { Dispatch, SetStateAction } from 'react';
import { db, uid } from '../db';
import type { AppView, AssistantAction, EventItem, ReminderItem, SheetColumn, SheetRow } from '../types';
import { sheetKey } from './assistantActions';

type ActionExecutorContext = {
  events: EventItem[];
  selectedSheetRowId: string | null;
  setEvents: Dispatch<SetStateAction<EventItem[]>>;
  setReminders: Dispatch<SetStateAction<ReminderItem[]>>;
  setSheetRows: Dispatch<SetStateAction<SheetRow[]>>;
  setSelectedSheetRowId: Dispatch<SetStateAction<string | null>>;
  setView: Dispatch<SetStateAction<AppView>>;
  deleteEventWithRelations: (eventId: string) => Promise<EventItem | undefined>;
};

export function createActionExecutor(context: ActionExecutorContext) {
  return async (action: AssistantAction): Promise<string | undefined> => {
    const now = new Date().toISOString();

    if (action.type === 'create_event') {
      const id = uid();
      const item: EventItem = { id, title: action.title, date: action.date, time: action.time, venue: action.venue, address: action.address, notes: action.notes, status: action.status || 'confirmed', createdAt: now, updatedAt: now };
      await db.events.add(item);
      context.setEvents((current) => [...current, item].sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`)));
      return `create_event id=${id} title="${action.title}" date=${action.date}${action.time ? ` time=${action.time}` : ''}`;
    }

    if (action.type === 'update_event') {
      const current = await db.events.get(action.eventId);
      const patch = { title: action.title, date: action.date, time: action.time, venue: action.venue, address: action.address, notes: action.notes, status: action.status, updatedAt: now };
      const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      await db.events.update(action.eventId, cleanPatch);
      context.setEvents((items) => items.map((item) => item.id === action.eventId ? { ...item, ...cleanPatch } as EventItem : item).sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`)));
      return `update_event id=${action.eventId} title="${action.title || current?.title || ''}"`;
    }

    if (action.type === 'delete_event') {
      const current = await context.deleteEventWithRelations(action.eventId);
      return `delete_event id=${action.eventId} title="${current?.title || ''}"`;
    }

    if (action.type === 'create_reminder') {
      const id = uid();
      const item: ReminderItem = { id, title: action.title, dueAt: action.dueAt, done: false, eventId: action.eventId, notes: action.notes, priority: action.priority || 'normal', repeat: action.repeat || 'none', notificationEnabled: action.notificationEnabled ?? true, createdAt: now, updatedAt: now };
      await db.reminders.add(item);
      context.setReminders((current) => [item, ...current]);
      return `create_reminder id=${id} title="${action.title}"${action.dueAt ? ` dueAt=${action.dueAt}` : ''}${action.eventId ? ` eventId=${action.eventId}` : ''}`;
    }

    if (action.type === 'update_reminder') {
      const current = await db.reminders.get(action.reminderId);
      const patch = { title: action.title, dueAt: action.dueAt, eventId: action.eventId, notes: action.notes, priority: action.priority, repeat: action.repeat, notificationEnabled: action.notificationEnabled, done: action.done, updatedAt: now };
      const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      await db.reminders.update(action.reminderId, cleanPatch);
      context.setReminders((items) => items.map((item) => item.id === action.reminderId ? { ...item, ...cleanPatch } as ReminderItem : item));
      return `update_reminder id=${action.reminderId} title="${action.title || current?.title || ''}"`;
    }

    if (action.type === 'delete_reminder') {
      const current = await db.reminders.get(action.reminderId);
      await db.reminders.delete(action.reminderId);
      context.setReminders((items) => items.filter((item) => item.id !== action.reminderId));
      return `delete_reminder id=${action.reminderId} title="${current?.title || ''}"`;
    }

    if (action.type === 'add_sheet_row') {
      const id = uid();
      const item: SheetRow = { id, label: action.label, category: action.category, amount: action.amount, status: action.status || 'pending', notes: action.notes, eventId: action.eventId, calendarDate: action.calendarDate, values: action.values || {}, createdAt: now, updatedAt: now };
      await db.sheetRows.add(item);
      context.setSheetRows((current) => [item, ...current]);
      return `add_sheet_row id=${id} label="${action.label}" amount=${action.amount}${action.eventId ? ` eventId=${action.eventId}` : ''}${action.calendarDate ? ` calendarDate=${action.calendarDate}` : ''}`;
    }

    if (action.type === 'update_sheet_row') {
      const current = await db.sheetRows.get(action.rowId);
      if (current) {
        const patch = { label: action.label, category: action.category, amount: action.amount, status: action.status, notes: action.notes, eventId: action.eventId, calendarDate: action.calendarDate, values: action.values ? { ...(current.values || {}), ...action.values } : undefined, updatedAt: now };
        const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
        await db.sheetRows.update(action.rowId, cleanPatch);
        context.setSheetRows((items) => items.map((item) => item.id === action.rowId ? { ...item, ...cleanPatch } as SheetRow : item));
      }
      return `update_sheet_row id=${action.rowId} label="${action.label || current?.label || ''}"`;
    }

    if (action.type === 'delete_sheet_row') {
      const current = await db.sheetRows.get(action.rowId);
      await db.transaction('rw', [db.sheetRows, db.sheetPhotos], async () => {
        await db.sheetPhotos.where('rowId').equals(action.rowId).delete();
        await db.sheetRows.delete(action.rowId);
      });
      context.setSheetRows((items) => items.filter((item) => item.id !== action.rowId));
      if (context.selectedSheetRowId === action.rowId) context.setSelectedSheetRowId(null);
      return `delete_sheet_row id=${action.rowId} label="${current?.label || ''}"`;
    }

    if (action.type === 'add_sheet_column') {
      const columns = await db.sheetColumns.orderBy('position').toArray();
      let key = action.key || sheetKey(action.name);
      const used = new Set(columns.map((column) => column.key));
      let suffix = 2;
      while (used.has(key)) key = `${sheetKey(action.name)}_${suffix++}`;
      const id = uid();
      const column: SheetColumn = { id, name: action.name, key, type: action.columnType || 'text', formula: action.formula, position: columns.length, createdAt: now };
      await db.sheetColumns.add(column);
      window.dispatchEvent(new Event('djnoa:sheet-columns-changed'));
      return `add_sheet_column id=${id} name="${action.name}" key=${key}`;
    }

    if (action.type === 'navigate') {
      context.setView(action.view);
      return `navigate view=${action.view}`;
    }

    if (action.type === 'open_map') {
      const event = context.events.find((item) => item.id === action.eventId);
      const destination = event?.address || event?.venue;
      if (destination) window.location.assign(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`);
      return `open_map eventId=${action.eventId}`;
    }

    return undefined;
  };
}
