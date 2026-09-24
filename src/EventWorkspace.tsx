import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Bell, CalendarDays, Camera, Check, FileSpreadsheet, MapPin, Navigation, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { db, uid } from './db';
import type { EventItem, EventPhoto, EventStatus, ReminderItem, SheetRow } from './types';

export type EventDraft = Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>;

type EventHubProps = {
  event: EventItem;
  reminders: ReminderItem[];
  sheetRows: SheetRow[];
  onClose: () => void;
  onEdit: () => void;
  onOpenCalendar: () => void;
  onOpenReminders: () => void;
  onOpenSheet: () => void;
  onToggleReminder: (item: ReminderItem) => Promise<void> | void;
};

type PhotoView = EventPhoto & { url: string };

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

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

export function EventHub({ event, reminders, sheetRows, onClose, onEdit, onOpenCalendar, onOpenReminders, onOpenSheet, onToggleReminder }: EventHubProps) {
  const [photos, setPhotos] = useState<PhotoView[]>([]);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const linkedReminders = useMemo(() => reminders.filter((item) => item.eventId === event.id).sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')), [reminders, event.id]);
  const linkedRows = useMemo(() => sheetRows.filter((row) => row.eventId === event.id), [sheetRows, event.id]);
  const pendingTasks = linkedReminders.filter((item) => !item.done).length;
  const total = linkedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const paid = linkedRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingAmount = linkedRows.filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const loadPhotos = async () => {
    const stored = await db.eventPhotos.where('eventId').equals(event.id).sortBy('createdAt');
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return stored.map((photo) => ({ ...photo, url: URL.createObjectURL(photo.blob) }));
    });
  };

  useEffect(() => {
    void loadPhotos();
    return () => setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return [];
    });
  }, [event.id]);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const createdAt = new Date().toISOString();
    const records: EventPhoto[] = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({ id: uid(), eventId: event.id, name: file.name, type: file.type, blob: file, createdAt }));
    if (!records.length) return;
    await db.eventPhotos.bulkAdd(records);
    await loadPhotos();
  };

  const deletePhoto = async (photo: PhotoView) => {
    await db.eventPhotos.delete(photo.id);
    await loadPhotos();
  };

  const mapsQuery = event.address || event.venue || '';

  return (
    <div className="event-hub-page">
      <header className="event-hub-header">
        <button onClick={onClose} aria-label="Volver"><ArrowLeft size={20} /></button>
        <div><span>EVENTO</span><strong>{event.title}</strong></div>
        <button onClick={onEdit} aria-label="Editar"><Pencil size={18} /></button>
      </header>

      <main className="event-hub-content">
        <section className="event-hub-hero">
          <div className="event-hub-date"><strong>{format(parseISO(event.date), 'dd')}</strong><span>{format(parseISO(event.date), 'MMM', { locale: es }).toUpperCase()}</span></div>
          <div className="event-hub-main"><p>{event.time || 'Horario pendiente'}</p><h2>{event.title}</h2><span>{event.venue || 'Lugar pendiente'}</span></div>
          <span className={`event-hub-status ${event.status}`}>{event.status === 'confirmed' ? 'Confirmado' : event.status === 'tentative' ? 'Por confirmar' : 'Terminado'}</span>
        </section>

        <section className="event-hub-metrics">
          <button onClick={onOpenReminders}><span>TAREAS</span><strong>{pendingTasks}</strong><small>pendientes</small></button>
          <button onClick={onOpenSheet}><span>GASTOS</span><strong>{money.format(total)}</strong><small>{linkedRows.length} movimientos</small></button>
          <button onClick={() => photoRef.current?.click()}><span>FOTOS</span><strong>{photos.length}</strong><small>guardadas</small></button>
        </section>

        <section className="event-hub-card event-hub-agenda">
          <div className="event-hub-section-head"><div><CalendarDays size={16} /><span>CALENDARIO</span></div><button onClick={onOpenCalendar}>Abrir</button></div>
          <div className="event-hub-info-grid">
            <div><span>FECHA</span><strong>{format(parseISO(event.date), "EEEE d 'de' MMMM", { locale: es })}</strong></div>
            <div><span>HORA</span><strong>{event.time || 'Sin hora'}</strong></div>
            <div className="event-hub-info-wide"><span>LUGAR</span><strong>{event.venue || 'Pendiente'}</strong></div>
          </div>
          {mapsQuery && <a className="event-hub-map" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noreferrer"><Navigation size={15} /> Cómo llegar</a>}
        </section>

        <section className="event-hub-card">
          <div className="event-hub-section-head"><div><Bell size={16} /><span>TAREAS Y RECORDATORIOS</span></div><button onClick={onOpenReminders}>Ver todo</button></div>
          {linkedReminders.length ? <div className="event-hub-task-list">{linkedReminders.slice(0, 6).map((item) => <div className={`event-hub-task ${item.done ? 'done' : ''}`} key={item.id}><button className="event-hub-task-check" onClick={() => void onToggleReminder(item)}><Check size={13} /></button><div><strong>{item.title}</strong><span>{item.dueAt ? format(parseISO(item.dueAt), "d MMM · HH:mm", { locale: es }) : 'Sin fecha'}{item.priority === 'high' ? ' · Alta prioridad' : ''}</span></div></div>)}</div> : <div className="event-hub-empty">Todavía no hay tareas vinculadas a este evento.</div>}
        </section>

        <section className="event-hub-card">
          <div className="event-hub-section-head"><div><FileSpreadsheet size={16} /><span>EXCEL / GASTOS</span></div><button onClick={onOpenSheet}>Abrir Excel</button></div>
          <div className="event-hub-finance"><div><span>TOTAL</span><strong>{money.format(total)}</strong></div><div><span>PAGADO</span><strong>{money.format(paid)}</strong></div><div><span>PENDIENTE</span><strong>{money.format(pendingAmount)}</strong></div></div>
          {linkedRows.length ? <div className="event-hub-row-list">{linkedRows.slice(0, 5).map((row) => <button key={row.id} onClick={onOpenSheet}><span>{row.label}</span><strong>{money.format(row.amount)}</strong><small>{row.category} · {row.status === 'paid' ? 'Pagado' : row.status === 'pending' ? 'Pendiente' : 'Info'}</small></button>)}</div> : <div className="event-hub-empty">No hay movimientos de Excel vinculados.</div>}
        </section>

        <section className="event-hub-card">
          <div className="event-hub-section-head"><div><Camera size={16} /><span>FOTOS</span></div><button onClick={() => photoRef.current?.click()}>Añadir</button></div>
          <input ref={photoRef} className="event-hub-file" type="file" accept="image/*" multiple onChange={(e) => { void addPhotos(e.target.files); e.currentTarget.value = ''; }} />
          {photos.length ? <div className="event-hub-photos">{photos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.name} /><button onClick={() => void deletePhoto(photo)} aria-label="Eliminar foto"><Trash2 size={13} /></button></figure>)}</div> : <button className="event-hub-photo-empty" onClick={() => photoRef.current?.click()}><Camera size={20} /><span>Añadir fotos del evento</span></button>}
        </section>

        <section className="event-hub-card">
          <div className="event-hub-section-head"><div><MapPin size={16} /><span>NOTAS</span></div><button onClick={onEdit}>Editar</button></div>
          <p className="event-hub-notes">{event.notes?.trim() || 'Sin notas todavía.'}</p>
          {event.address && <p className="event-hub-address">{event.address}</p>}
        </section>
      </main>
    </div>
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
