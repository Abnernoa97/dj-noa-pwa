import type { CurrencyCode, EventItem, EventStatus, FinancialType, SheetStatus } from './types';

export type NoahEventPatch = Partial<Pick<EventItem,
  | 'title'
  | 'date'
  | 'time'
  | 'callTime'
  | 'soundcheckTime'
  | 'showTime'
  | 'venue'
  | 'address'
  | 'details'
  | 'dressCode'
  | 'contactName'
  | 'contactPhone'
  | 'mapUrl'
  | 'notes'
  | 'status'
>>;

export type NoahFinanceInput = {
  amount: number;
  currency: CurrencyCode;
  label?: string;
  category?: string;
  status?: SheetStatus;
  financialType?: FinancialType;
  notes?: string;
  description?: string;
};

export type NoahNavigableSection = 'home' | 'events' | 'calendar' | 'sheet' | 'reminders';
export type NoahActionSurface = 'events' | 'calendar' | 'sheet';

export type NoahEventAction =
  | {
      type: 'create_event';
      event: NoahEventPatch & { title: string; date: string; status?: EventStatus };
      surface?: Exclude<NoahActionSurface, 'sheet'>;
      finance?: NoahFinanceInput;
      createExcelConcept?: boolean;
    }
  | {
      type: 'create_calendar_series';
      event: NoahEventPatch & { title: string; status?: EventStatus };
      startDate: string;
      endDate: string;
      weekdays: number[];
      finance?: NoahFinanceInput;
    }
  | { type: 'sync_event_finance'; eventId: string; finance: NoahFinanceInput; surface?: NoahActionSurface }
  | { type: 'create_sheet_row'; row: NoahFinanceInput & { label?: string; calendarDate?: string }; surface?: NoahActionSurface }
  | { type: 'update_event'; eventId: string; patch: NoahEventPatch }
  | { type: 'delete_event'; eventId: string }
  | { type: 'open_event'; eventId: string }
  | { type: 'open_events' }
  | { type: 'navigate_section'; section: NoahNavigableSection };

export type NoahEventActionResult = {
  ok: boolean;
  message: string;
};

export type NoahActionStep = {
  id: string;
  label: string;
  value?: string;
  state: 'pending' | 'active' | 'done';
};

export type NoahActionActivity = {
  phase: 'working' | 'done' | 'error';
  title: string;
  detail?: string;
  scope?: string;
  steps?: NoahActionStep[];
};

const sectionNames: Record<NoahNavigableSection, string> = {
  home: 'Inicio',
  events: 'Eventos',
  calendar: 'Calendario',
  sheet: 'Excel',
  reminders: 'Tareas'
};

export function sectionName(section: NoahNavigableSection) {
  return sectionNames[section];
}

export function eventActionLabel(action: NoahEventAction, events: EventItem[]) {
  if (action.type === 'navigate_section') return { title: `Abriendo ${sectionName(action.section)}`, detail: 'Cambiando de sección', scope: 'NAVEGACIÓN' };
  if (action.type === 'open_events') return { title: 'Abriendo Eventos', detail: 'Agenda de eventos', scope: 'EVENTOS' };
  if (action.type === 'create_calendar_series') return { title: 'Creando serie', detail: action.event.title, scope: action.finance ? 'MATRIZ' : 'CALENDARIO' };
  if (action.type === 'create_event') return { title: 'Creando evento', detail: action.event.title, scope: action.finance ? 'MATRIZ' : action.surface === 'events' ? 'EVENTOS' : 'CALENDARIO' };
  if (action.type === 'create_sheet_row') return { title: 'Agregando movimiento', detail: action.row.label || `${action.row.amount} ${action.row.currency}`, scope: 'EXCEL' };
  const event = 'eventId' in action ? events.find((item) => item.id === action.eventId) : undefined;
  const name = event?.title || 'Evento';
  if (action.type === 'sync_event_finance') return { title: 'Sincronizando monto', detail: name, scope: 'MATRIZ' };
  if (action.type === 'update_event') return { title: 'Actualizando evento', detail: name, scope: 'EVENTOS' };
  if (action.type === 'delete_event') return { title: 'Eliminando evento', detail: name, scope: 'EVENTOS' };
  return { title: 'Abriendo evento', detail: name, scope: 'EVENTOS' };
}
