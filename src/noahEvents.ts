import type { EventItem, EventStatus } from './types';

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

export type NoahEventAction =
  | { type: 'create_event'; event: NoahEventPatch & { title: string; date: string; status?: EventStatus } }
  | { type: 'update_event'; eventId: string; patch: NoahEventPatch }
  | { type: 'delete_event'; eventId: string }
  | { type: 'open_event'; eventId: string }
  | { type: 'open_events' };

export type NoahEventActionResult = {
  ok: boolean;
  message: string;
};

export type NoahActionActivity = {
  phase: 'working' | 'done' | 'error';
  title: string;
  detail?: string;
};

export function eventActionLabel(action: NoahEventAction, events: EventItem[]) {
  if (action.type === 'open_events') return { title: 'Abriendo Eventos', detail: 'Agenda de eventos' };
  if (action.type === 'create_event') return { title: 'Creando evento', detail: action.event.title };
  const event = events.find((item) => item.id === action.eventId);
  const name = event?.title || 'Evento';
  if (action.type === 'update_event') return { title: 'Actualizando evento', detail: name };
  if (action.type === 'delete_event') return { title: 'Eliminando evento', detail: name };
  return { title: 'Abriendo evento', detail: name };
}
