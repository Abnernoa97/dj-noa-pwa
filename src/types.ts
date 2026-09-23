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

export interface SheetRow {
  id: string;
  label: string;
  category: string;
  amount: number;
  status: 'pending' | 'paid' | 'info';
  eventId?: string;
  notes?: string;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  command: string;
  result: string;
  createdAt: string;
}

export type AppView = 'home' | 'calendar' | 'sheet' | 'reminders';

export type AssistantAction =
  | { type: 'create_event'; title: string; date: string; time?: string; venue?: string; address?: string; notes?: string }
  | { type: 'create_reminder'; title: string; dueAt?: string }
  | { type: 'add_sheet_row'; label: string; category: string; amount: number; status?: 'pending' | 'paid' | 'info'; notes?: string }
  | { type: 'navigate'; view: AppView }
  | { type: 'query_total' }
  | { type: 'none'; message?: string };

export interface AssistantResponse {
  reply: string;
  actions: AssistantAction[];
}
