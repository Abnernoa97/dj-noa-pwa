export type EventStatus = 'confirmed' | 'tentative' | 'done';

export interface EventItem {
  id: string;
  title: string;
  date: string;
  time?: string;
  venue?: string;
  address?: string;
  notes?: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  dueAt?: string;
  done: boolean;
  eventId?: string;
  createdAt: string;
}

export type SheetStatus = 'pending' | 'paid' | 'info';
export type SheetValue = string | number | boolean | null;

export interface SheetRow {
  id: string;
  label: string;
  category: string;
  amount: number;
  status: SheetStatus;
  eventId?: string;
  notes?: string;
  values?: Record<string, SheetValue>;
  createdAt: string;
  updatedAt?: string;
}

export interface SheetColumn {
  id: string;
  name: string;
  key: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'formula';
  formula?: string;
  position: number;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  command: string;
  result: string;
  createdAt: string;
}

export type AppView = 'home' | 'events' | 'calendar' | 'sheet' | 'reminders';

export type AssistantAction =
  | { type: 'create_event'; title: string; date: string; time?: string; venue?: string; address?: string; notes?: string; status?: EventStatus }
  | { type: 'update_event'; eventId: string; title?: string; date?: string; time?: string; venue?: string; address?: string; notes?: string; status?: EventStatus }
  | { type: 'delete_event'; eventId: string }
  | { type: 'create_reminder'; title: string; dueAt?: string; eventId?: string }
  | { type: 'add_sheet_row'; label: string; category: string; amount: number; status?: SheetStatus; notes?: string; eventId?: string; values?: Record<string, SheetValue> }
  | { type: 'update_sheet_row'; rowId: string; label?: string; category?: string; amount?: number; status?: SheetStatus; notes?: string; eventId?: string; values?: Record<string, SheetValue> }
  | { type: 'delete_sheet_row'; rowId: string }
  | { type: 'add_sheet_column'; name: string; key?: string; columnType?: SheetColumn['type']; formula?: string }
  | { type: 'navigate'; view: AppView }
  | { type: 'query_total'; category?: string; status?: SheetStatus }
  | { type: 'none'; message?: string };

export interface AssistantResponse {
  reply: string;
  actions: AssistantAction[];
}
