import type { AppView, AssistantAction } from '../types';

export const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export type LiveActionState = {
  current: number;
  total: number;
  title: string;
  detail: string;
  status: 'working' | 'done' | 'error' | 'cancelled';
};

export type CommandCreatedEvent = {
  id: string;
  date: string;
};

export const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function sheetKey(name: string) {
  const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `custom_${clean || Date.now()}`;
}

export function isUndoCommand(value: string) {
  return /^\s*(deshaz|deshacer|revierte|revertir|undo)(?:\s+(?:lo|la)?\s*[uú]ltim[oa])?[.!]?\s*$/i.test(value);
}

export function isCancelCommand(value: string) {
  return /^\s*(cancela|cancelar|detente|deténte|para|párate|alto|espera|stop)(?:\s+(?:ya|ah[ií]|dj\s*noa))?[.!]?\s*$/i.test(value);
}

export function isMutatingAction(action: AssistantAction) {
  return [
    'create_event', 'update_event', 'delete_event',
    'create_reminder', 'update_reminder', 'delete_reminder',
    'add_sheet_row', 'update_sheet_row', 'delete_sheet_row', 'add_sheet_column'
  ].includes(action.type);
}

export function bindActionToCreatedEvent(action: AssistantAction, createdEvent: CommandCreatedEvent | null): AssistantAction {
  if (!createdEvent) return action;
  if (action.type === 'create_reminder' && action.eventRef === 'created_event') {
    return { ...action, eventId: createdEvent.id };
  }
  if (action.type === 'add_sheet_row' && action.eventRef === 'created_event') {
    return { ...action, eventId: createdEvent.id, calendarDate: action.calendarDate || createdEvent.date };
  }
  return action;
}

export function createdEventIdFromSummary(summary?: string) {
  return summary?.match(/^create_event id=([^\s]+)/)?.[1] || null;
}

export function actionMeta(action: AssistantAction): { visible: boolean; view?: AppView; title: string; detail: string } {
  if (action.type === 'create_event') return { visible: true, view: 'calendar', title: 'Agregando al calendario', detail: action.title };
  if (action.type === 'update_event') return { visible: true, view: 'events', title: 'Actualizando evento', detail: action.title || 'Aplicando cambios' };
  if (action.type === 'delete_event') return { visible: true, view: 'events', title: 'Eliminando evento', detail: 'Conservando y desvinculando su información relacionada' };
  if (action.type === 'create_reminder') return { visible: true, view: 'reminders', title: 'Creando tarea', detail: action.title };
  if (action.type === 'update_reminder') return { visible: true, view: 'reminders', title: 'Actualizando tarea', detail: action.title || 'Aplicando cambios' };
  if (action.type === 'delete_reminder') return { visible: true, view: 'reminders', title: 'Eliminando tarea', detail: 'Actualizando recordatorios' };
  if (action.type === 'add_sheet_row') return { visible: true, view: 'sheet', title: 'Añadiendo a Excel', detail: `${action.label} · ${money.format(action.amount)}` };
  if (action.type === 'update_sheet_row') return { visible: true, view: 'sheet', title: 'Actualizando Excel', detail: action.label || 'Aplicando cambios a la fila' };
  if (action.type === 'delete_sheet_row') return { visible: true, view: 'sheet', title: 'Eliminando fila', detail: 'Eliminando también sus fotos vinculadas' };
  if (action.type === 'add_sheet_column') return { visible: true, view: 'sheet', title: 'Creando columna', detail: action.name };
  if (action.type === 'navigate') return { visible: true, view: action.view, title: 'Abriendo sección', detail: action.view === 'sheet' ? 'Excel' : action.view === 'reminders' ? 'Tareas' : action.view === 'calendar' ? 'Calendario' : action.view === 'events' ? 'Eventos' : 'Inicio' };
  if (action.type === 'open_map') return { visible: true, view: 'events', title: 'Preparando ruta', detail: 'Abriendo ubicación del evento' };
  return { visible: false, title: '', detail: '' };
}
