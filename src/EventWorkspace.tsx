import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Navigation, Plus, Save, Trash2, X } from 'lucide-react';
import type { EventItem, EventStatus } from './types';

export type EventDraft = Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>;

export function EventsView({ events, onOpen, onCreate }: { events: EventItem[]; onOpen: (event: EventItem) => void; onCreate: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const sorted = [...events].sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`));
  const upcoming = sorted.filter((event) => event.date >= today && event.status !== 'done');
  const history = sorted.filter((event) => event.date < today || event.status === 'done').reverse();
  return (
    <section className="page-card events-page">
      <div className="page-title-row"><div><p className="eyebrow">AGENDA PERSONAL</p><h2>Eventos</h2></div><button className="round-plus" onClick={onCreate}><Plus size={20} /></button></div>
      <div className="events-section-label">PRÓXIMOS</div>
      <div className="event-list">{upcoming.length ? upcoming.map((event) => <EventRow key={event.id} event={event} onOpen={onOpen} />) : <div className="empty-table">No hay eventos próximos.</div>}</div>
      {history.length > 0 && <><div className="events-section-label history-label">HISTORIAL</div><div className="event-list history-list">{history.map((event) => <EventRow key={event.id} event={event} onOpen={onOpen} />)}</div></>}
      <button className="full-action" onClick={onCreate}><Plus size={18} /> Nuevo evento</button>
    </section>
  );
}

function EventRow({ event, onOpen }: { event: EventItem; onOpen: (event: EventItem) => void }) {
  return (
    <button className="event-row" onClick={() => onOpen(event)}>
      <div className="event-row-date"><strong>{format(parseISO(event.date), 'dd')}</strong><span>{format(parseISO(event.date), 'MMM', { locale: es }).toUpperCase()}</span></div>
      <div className="event-row-copy"><strong>{event.title}</strong><span>{event.time || 'Sin hora'}{event.venue ? ` · ${event.venue}` : ''}</span></div>
      <span className={`event-status-dot ${event.status}`} title={event.status} />
    </button>
  );
}

export function EventEditor({ event, initialDate, onClose, onSave, onDelete }: { event: EventItem | null; initialDate?: string | null; onClose: () => void; onSave: (draft: EventDraft) => Promise<void>; onDelete: () => Promise<void> }) {
  const [draft, setDraft] = useState<EventDraft>(() => ({ title: event?.title || '', date: event?.date || initialDate || format(new Date(), 'yyyy-MM-dd'), time: event?.time || '', venue: event?.venue || '', address: event?.address || '', notes: event?.notes || '', status: event?.status || 'confirmed' }));
  const update = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!draft.title.trim() || !draft.date) return;
    await onSave({ ...draft, title: draft.title.trim(), venue: draft.venue?.trim(), address: draft.address?.trim(), notes: draft.notes?.trim() });
  };
  return (
    <div className="event-editor-backdrop" onClick={onClose}>
      <section className="event-editor" onClick={(e) => e.stopPropagation()}>
        <div className="assistant-handle" />
        <div className="event-editor-head"><div><p className="eyebrow">{event ? 'EDITAR EVENTO' : 'NUEVO EVENTO'}</p><h3>{event ? event.title : 'Crear evento'}</h3></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
        <div className="event-form">
          <label><span>NOMBRE</span><input value={draft.title} onChange={(e) => update('title', e.target.value)} placeholder="Ej. Boda Flora Farms" /></label>
          <div className="event-form-grid"><label><span>FECHA</span><input type="date" value={draft.date} onChange={(e) => update('date', e.target.value)} /></label><label><span>HORA</span><input type="time" value={draft.time || ''} onChange={(e) => update('time', e.target.value)} /></label></div>
          <label><span>LUGAR</span><input value={draft.venue || ''} onChange={(e) => update('venue', e.target.value)} placeholder="Venue" /></label>
          <label><span>DIRECCIÓN</span><input value={draft.address || ''} onChange={(e) => update('address', e.target.value)} placeholder="Dirección completa" /></label>
          <label><span>ESTADO</span><select value={draft.status} onChange={(e) => update('status', e.target.value as EventStatus)}><option value="confirmed">Confirmado</option><option value="tentative">Por confirmar</option><option value="done">Terminado</option></select></label>
          <label><span>NOTAS</span><textarea rows={3} value={draft.notes || ''} onChange={(e) => update('notes', e.target.value)} placeholder="Información importante" /></label>
        </div>
        {draft.address || draft.venue ? <a className="editor-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(draft.address || draft.venue || '')}`} target="_blank" rel="noreferrer"><Navigation size={16} /> Cómo llegar</a> : null}
        <div className="event-editor-actions">
          {event && <button className="delete-event-button" onClick={() => { if (window.confirm(`¿Eliminar ${event.title}?`)) void onDelete(); }}><Trash2 size={17} /> Eliminar</button>}
          <button className="save-event-button" onClick={() => void submit()} disabled={!draft.title.trim() || !draft.date}><Save size={17} /> Guardar</button>
        </div>
      </section>
    </div>
  );
}
