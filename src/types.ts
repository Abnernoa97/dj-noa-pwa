export type EventStatus = 'confirmed' | 'tentative' | 'done';

export interface EventItem {
  id: string;
  title: string;
  date: string;
  time?: string;
  callTime?: string;
  soundcheckTime?: string;
  showTime?: string;
  venue?: string;
  address?: string;
  details?: string;
  dressCode?: string;
  contactName?: string;
  contactPhone?: string;
  mapUrl?: string;
  notes?: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventPhoto {
  id: string;
  eventId: string;
  name: string;
  type: string;
  blob: Blob;
  createdAt: string;
}

export type ReminderPriority = 'low' | 'normal' | 'high';
export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

export interface ReminderItem {
  id: string;
  title: string;
  dueAt?: string;
  done: boolean;
  eventId?: string;
  notes?: string;
  priority?: ReminderPriority;
  repeat?: ReminderRepeat;
  notificationEnabled?: boolean;
  lastNotifiedAt?: string;
  lastCompletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type SheetStatus = 'pending' | 'paid' | 'info';
export type FinancialType = 'income' | 'expense' | 'neutral';
export type CurrencyCode = 'MXN' | 'USD';
export type SheetValue = string | number | boolean | null | { [key: string]: SheetValue };

export interface SheetRow {
  id: string;
  label: string;
  category: string;
  amount: number;
  currency?: CurrencyCode;
  status: SheetStatus;
  financialType?: FinancialType;
  eventId?: string;
  calendarDate?: string;
  notes?: string;
  description?: string;
  values?: Record<string, SheetValue>;
  createdAt: string;
  updatedAt?: string;
}

export interface SheetPhoto {
  id: string;
  rowId: string;
  name: string;
  type: string;
  blob: Blob;
  createdAt: string;
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