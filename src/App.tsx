import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, CalendarDays, FileSpreadsheet, Home, MapPin, Mic, MicOff, Navigation, Plus, Send, Sparkles, X } from 'lucide-react';
import { addDays, addMonths, addWeeks, format, isAfter, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { askAssistant } from './assistant';
import CalendarWorkspace from './CalendarWorkspace';
import { EventEditor, EventsView, type EventDraft } from './EventWorkspace';
import ReminderWorkspace from './ReminderWorkspace';
import SheetWorkspace from './SheetWorkspace';
import { db, uid } from './db';
import { scheduleReminderNotifications } from './reminderNotifications';
import { useDjNoaVoice } from './useDjNoaVoice';
import type { AppView, AssistantAction, EventItem, ReminderItem, SheetColumn, SheetRow } from './types';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

type LiveActionState = {
  current: number;
  total: number;
  title: string;
  detail: string;
  status: 'working' | 'done' | 'error';
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function safeDate(value?: string) {
  if (!value) return null;
  try { return parseISO(value); } catch { return null; }
}

function sheetKey(name: string) {
  const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `custom_${clean || Date.now()}`;
}

function nextReminderDate(dueAt: string, repeat: ReminderItem['repeat']) {
  const current = parseISO(dueAt);
  const next = repeat === 'daily' ? addDays(current, 1) : repeat === 'weekly' ? addWeeks(current, 1) : repeat === 'monthly' ? addMonths(current, 1) : current;
  return next.toISOString();
}

function actionMeta(action: AssistantAction): { visible: boolean; view?: AppView; title: string; detail: string } {
  if (action.type === 'create_event') return { visible: true, view: 'events', title: 'Creando evento', detail: action.title };
  if (action.type === 'update_event') return { visible: true, view: 'events', title: 'Actualizando evento', detail: action.title || 'Aplicando cambios' };
  if (action.type === 'delete_event') return { visible: true, view: 'events', title: 'Eliminando evento', detail: 'Actualizando agenda' };
  if (action.type === 'create_reminder') return { visible: true, view: 'reminders', title: 'Creando tarea', detail: action.title };
  if (action.type === 'update_reminder') return { visible: true, view: 'reminders', title: 'Actualizando tarea', detail: action.title || 'Aplicando cambios' };
  if (action.type === 'delete_reminder') return { visible: true, view: 'reminders', title: 'Eliminando tarea', detail: 'Actualizando recordatorios' };
  if (action.type === 'add_sheet_row') return { visible: true, view: 'sheet', title: 'Añadiendo a Excel', detail: `${action.label} · ${money.format(action.amount)}` };
  if (action.type === 'update_sheet_row') return { visible: true, view: 'sheet', title: 'Actualizando Excel', detail: action.label || 'Aplicando cambios a la fila' };
  if (action.type === 'delete_sheet_row') return { visible: true, view: 'sheet', title: 'Eliminando fila', detail: 'Actualizando Excel' };
  if (action.type === 'add_sheet_column') return { visible: true, view: 'sheet', title: 'Creando columna', detail: action.name };
  if (action.type === 'navigate') return { visible: true, view: action.view, title: 'Abriendo sección', detail: action.view === 'sheet' ? 'Excel' : action.view === 'reminders' ? 'Tareas' : action.view === 'calendar' ? 'Calendario' : action.view === 'events' ? 'Eventos' : 'Inicio' };
  if (action.type === 'open_map') return { visible: true, view: 'events', title: 'Preparando ruta', detail: 'Abriendo ubicación del evento' };
  return { visible: false, title: '', detail: '' };
}

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [assistantReply, setAssistantReply] = useState('Dime qué necesitas y lo hago.');
  const [busy, setBusy] = useState(false);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventCreateDate, setEventCreateDate] = useState<string | null>(null);
  const [liveAction, setLiveAction] = useState<LiveActionState | null>(null);

  const refresh = async () => {
    const [eventData, reminderData, sheetData] = await Promise.all([
      db.events.orderBy('date').toArray(),
      db.reminders.orderBy('createdAt').reverse().toArray(),
      db.sheetRows.orderBy('createdAt').reverse().toArray()
    ]);
    setEvents(eventData);
    setReminders(reminderData);
    setSheetRows(sheetData);
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => scheduleReminderNotifications(reminders), [reminders]);
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!navigator.onLine) {
        if (active) setAiOnline(false);
        return;
      }
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        const payload = await response.json() as { service?: string };
        if (active) setAiOnline(response.ok && payload.service === 'dj-noa-worker');
      } catch {
        if (active) setAiOnline(false);
      }
    };
    const onOnline = () => void check();
    const onOffline = () => setAiOnline(false);
    void check();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const timer = window.setInterval(() => void check(), 60_000);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(timer);
    };
  }, []);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.find((event) => {
      const date = safeDate(event.date);
      return date && (isSameDay(date, today) || isAfter(date, today));
    });
  }, [events]);

  const total = useMemo(() => sheetRows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [sheetRows]);
  const openReminders = reminders.filter((item) => !item.done).length;
  const focusReminders = useMemo(() => reminders.filter((item) => !item.done).sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')).slice(0, 3), [reminders]);
  const todayEventCount = useMemo(() => events.filter((item) => item.date === format(new Date(), 'yyyy-MM-dd')).length, [events]);

  const openEventEditor = (event?: EventItem, createDate?: string) => {
    setSelectedEvent(event || null);
    setEventCreateDate(event ? null : createDate || null);
    setEventEditorOpen(true);
  };

  const saveEvent = async (draft: EventDraft) => {
    const now = new Date().toISOString();
    if (selectedEvent) await db.events.update(selectedEvent.id, { ...draft, updatedAt: now });
    else await db.events.add({ ...draft, id: uid(), createdAt: now, updatedAt: now });
    setEventEditorOpen(false);
    setSelectedEvent(null);
    setEventCreateDate(null);
    await refresh();
  };

  const deleteEvent = async () => {
    if (!selectedEvent) return;
    await db.events.delete(selectedEvent.id);
    setEventEditorOpen(false);
    setSelectedEvent(null);
    setEventCreateDate(null);
    await refresh();
  };

  const executeAction = async (action: AssistantAction) => {
    const now = new Date().toISOString();
    if (action.type === 'create_event') await db.events.add({ id: uid(), title: action.title, date: action.date, time: action.time, venue: action.venue, address: action.address, notes: action.notes, status: action.status || 'confirmed', createdAt: now, updatedAt: now });
    if (action.type === 'update_event') {
      const patch = { title: action.title, date: action.date, time: action.time, venue: action.venue, address: action.address, notes: action.notes, status: action.status, updatedAt: now };
      await db.events.update(action.eventId, Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)));
    }
    if (action.type === 'delete_event') await db.events.delete(action.eventId);
    if (action.type === 'create_reminder') await db.reminders.add({ id: uid(), title: action.title, dueAt: action.dueAt, done: false, eventId: action.eventId, notes: action.notes, priority: action.priority || 'normal', repeat: action.repeat || 'none', notificationEnabled: action.notificationEnabled ?? true, createdAt: now, updatedAt: now });
    if (action.type === 'update_reminder') {
      const patch = { title: action.title, dueAt: action.dueAt, eventId: action.eventId, notes: action.notes, priority: action.priority, repeat: action.repeat, notificationEnabled: action.notificationEnabled, done: action.done, updatedAt: now };
      await db.reminders.update(action.reminderId, Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)));
    }
    if (action.type === 'delete_reminder') await db.reminders.delete(action.reminderId);
    if (action.type === 'add_sheet_row') await db.sheetRows.add({ id: uid(), label: action.label, category: action.category, amount: action.amount, status: action.status || 'pending', notes: action.notes, eventId: action.eventId, calendarDate: action.calendarDate, values: action.values || {}, createdAt: now, updatedAt: now });
    if (action.type === 'update_sheet_row') {
      const current = await db.sheetRows.get(action.rowId);
      if (current) {
        const patch = { label: action.label, category: action.category, amount: action.amount, status: action.status, notes: action.notes, eventId: action.eventId, calendarDate: action.calendarDate, values: action.values ? { ...(current.values || {}), ...action.values } : undefined, updatedAt: now };
        await db.sheetRows.update(action.rowId, Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)));
      }
    }
    if (action.type === 'delete_sheet_row') await db.sheetRows.delete(action.rowId);
    if (action.type === 'add_sheet_column') {
      const columns = await db.sheetColumns.orderBy('position').toArray();
      let key = action.key || sheetKey(action.name);
      const used = new Set(columns.map((column) => column.key));
      let suffix = 2;
      while (used.has(key)) key = `${sheetKey(action.name)}_${suffix++}`;
      const column: SheetColumn = { id: uid(), name: action.name, key, type: action.columnType || 'text', formula: action.formula, position: columns.length, createdAt: now };
      await db.sheetColumns.add(column);
    }
    if (action.type === 'navigate') setView(action.view);
    if (action.type === 'open_map') {
      const event = events.find((item) => item.id === action.eventId);
      const destination = event?.address || event?.venue;
      if (destination) window.location.assign(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`);
    }
  };

  const runCommand = async (text = command): Promise<string | undefined> => {
    const clean = text.trim();
    if (!clean || busy) return undefined;
    setBusy(true);
    try {
      const response = await askAssistant(clean, { events, reminders, sheetRows });
      const visibleTotal = response.actions.filter((action) => actionMeta(action).visible).length;
      let visibleIndex = 0;

      if (visibleTotal) {
        setAssistantOpen(false);
        setEventEditorOpen(false);
        setSelectedEvent(null);
        setEventCreateDate(null);
        setCommand('');
      }

      for (const action of response.actions) {
        const meta = actionMeta(action);
        if (meta.visible) {
          visibleIndex += 1;
          if (meta.view) setView(meta.view);
          setLiveAction({ current: visibleIndex, total: visibleTotal, title: meta.title, detail: meta.detail, status: 'working' });
          await sleep(320);
        }

        try {
          await executeAction(action);
          await refresh();
        } catch {
          const failReply = meta.title ? `No pude completar: ${meta.title.toLowerCase()}.` : 'No pude completar esa acción.';
          setAssistantReply(failReply);
          if (meta.visible) {
            setLiveAction({ current: visibleIndex, total: visibleTotal, title: meta.title, detail: 'La acción se detuvo aquí.', status: 'error' });
            await sleep(1400);
            setLiveAction(null);
          }
          await db.history.add({ id: uid(), command: clean, result: failReply, createdAt: new Date().toISOString() });
          return failReply;
        }

        if (meta.visible) {
          setLiveAction({ current: visibleIndex, total: visibleTotal, title: meta.title, detail: meta.detail, status: 'done' });
          await sleep(520);
        }
      }

      await db.history.add({ id: uid(), command: clean, result: response.reply, createdAt: new Date().toISOString() });
      setAssistantReply(response.reply);
      setCommand('');
      await refresh();

      if (visibleTotal) {
        setLiveAction({ current: visibleTotal, total: visibleTotal, title: 'Listo', detail: response.reply, status: 'done' });
        await sleep(950);
        setLiveAction(null);
      }

      return response.reply;
    } finally {
      setBusy(false);
    }
  };

  const { active: voiceActive, listening, toggle: startListening } = useDjNoaVoice({
    onCommand: runCommand,
    onOpen: () => setAssistantOpen(true),
    onLiveText: setCommand,
    onStatus: setAssistantReply
  });

  const toggleReminder = async (item: ReminderItem) => {
    const now = new Date().toISOString();
    if (!item.done && item.repeat && item.repeat !== 'none' && item.dueAt) {
      await db.reminders.update(item.id, { dueAt: nextReminderDate(item.dueAt, item.repeat), done: false, lastCompletedAt: now, lastNotifiedAt: undefined, updatedAt: now });
    } else {
      await db.reminders.update(item.id, { done: !item.done, lastCompletedAt: !item.done ? now : item.lastCompletedAt, updatedAt: now });
    }
    await refresh();
  };

  return (
    <div className="app-shell">
      <div className="background-photo" aria-hidden="true" />
      <div className="background-shade" aria-hidden="true" />

      <header className="topbar"><div><h1>DJ NOA</h1><p className="topbar-date">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p></div></header>

      <main className="content">
        {view === 'home' && (
          <section className="home-view">
            <div className="home-summary"><div><span>HOY</span><strong>{todayEventCount ? `${todayEventCount} evento${todayEventCount > 1 ? 's' : ''}` : 'Sin eventos hoy'}</strong></div><button onClick={startListening}><Mic size={18} /> Hablar con DJ NOA</button></div>
            <article className="glass-card next-event-card">
              <div className="card-heading"><span>PRÓXIMO EVENTO</span><CalendarDays size={19} /></div>
              {upcoming ? <><div className="event-date-block"><strong>{format(parseISO(upcoming.date), 'dd')}</strong><span>{format(parseISO(upcoming.date), 'MMM', { locale: es }).toUpperCase()}</span></div><div className="event-main-copy"><h3>{upcoming.title}</h3><p>{upcoming.time || 'Horario pendiente'}{upcoming.venue ? ` · ${upcoming.venue}` : ''}</p><div className="event-home-actions">{(upcoming.address || upcoming.venue) && <a className="direction-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(upcoming.address || upcoming.venue || '')}`} target="_blank" rel="noreferrer"><Navigation size={16} /> Cómo llegar</a>}<button className="event-detail-link" onClick={() => openEventEditor(upcoming)}>Detalles</button></div></div></> : <div className="empty-state"><p>No hay eventos próximos.</p><button onClick={() => openEventEditor()}><Plus size={16} /> Crear evento</button></div>}
            </article>
            <div className="section-label-row"><span>ACCESOS RÁPIDOS</span></div>
            <div className="quick-grid"><button className="glass-card quick-card" onClick={() => setView('events')}><div className="quick-icon"><MapPin size={21} /></div><div><span>Eventos</span><strong>{events.length} registrados</strong></div></button><button className="glass-card quick-card" onClick={() => setView('calendar')}><div className="quick-icon"><CalendarDays size={21} /></div><div><span>Calendario</span><strong>{events.length} eventos</strong></div></button><button className="glass-card quick-card" onClick={() => setView('sheet')}><div className="quick-icon"><FileSpreadsheet size={21} /></div><div><span>Excel</span><strong>{money.format(total)}</strong></div></button><button className="glass-card quick-card" onClick={() => setView('reminders')}><div className="quick-icon"><Bell size={21} /></div><div><span>Recordatorios</span><strong>{openReminders} pendientes</strong></div></button></div>
            <div className="section-label-row"><span>LO SIGUIENTE</span><button onClick={() => setView('reminders')}>Ver todo</button></div>
            <div className="focus-list">{focusReminders.length ? focusReminders.map((item) => <button key={item.id} className="focus-row" onClick={() => void toggleReminder(item)}><span className="focus-check" /><div><strong>{item.title}</strong><small>{item.dueAt ? format(parseISO(item.dueAt), "d MMM · HH:mm", { locale: es }) : 'Sin fecha'}</small></div></button>) : <div className="focus-empty">Nada pendiente por ahora.</div>}</div>
          </section>
        )}
        {view === 'events' && <EventsView events={events} onOpen={openEventEditor} onCreate={() => openEventEditor()} />}
        {view === 'calendar' && <CalendarWorkspace month={month} setMonth={setMonth} events={events} reminders={reminders} sheetRows={sheetRows} onOpenEvent={openEventEditor} onCreateEvent={(date) => openEventEditor(undefined, date)} onToggleReminder={toggleReminder} onOpenReminders={() => setView('reminders')} onOpenSheetRow={() => setView('sheet')} />}
        {view === 'sheet' && <SheetWorkspace rows={sheetRows} events={events} onChanged={refresh} onAssistant={() => setAssistantOpen(true)} />}
        {view === 'reminders' && <ReminderWorkspace items={reminders} events={events} onChanged={refresh} onAssistant={() => setAssistantOpen(true)} />}
      </main>

      {liveAction && <div className={`dj-live-action ${liveAction.status}`} role="status" aria-live="polite"><div className="dj-live-head"><div className="dj-live-kicker"><span className="dj-live-dot" />DJ NOA · {liveAction.status === 'working' ? 'TRABAJANDO' : liveAction.status === 'done' ? 'HECHO' : 'DETENIDO'}</div><span className="dj-live-count">{liveAction.current} de {liveAction.total}</span></div><strong>{liveAction.title}</strong><small>{liveAction.detail}</small><div className="dj-live-track"><span style={{ width: `${Math.max(8, (liveAction.current / Math.max(1, liveAction.total)) * 100)}%` }} /></div></div>}

      <button className={`voice-orb ${voiceActive ? 'listening' : ''}`} onClick={startListening} disabled={busy} aria-label={voiceActive ? 'Pausar DJ NOA' : 'Hablar con DJ NOA'}>{voiceActive ? <MicOff size={28} /> : <Mic size={28} />}<span>{listening ? 'ESCUCHANDO' : voiceActive ? 'ACTIVO' : 'HABLAR'}</span></button>

      <nav className="bottom-nav"><NavButton active={view === 'home'} icon={<Home size={20} />} label="Inicio" onClick={() => setView('home')} /><NavButton active={view === 'events'} icon={<MapPin size={20} />} label="Eventos" onClick={() => setView('events')} /><NavButton active={view === 'calendar'} icon={<CalendarDays size={20} />} label="Calendario" onClick={() => setView('calendar')} /><NavButton active={view === 'sheet'} icon={<FileSpreadsheet size={20} />} label="Excel" onClick={() => setView('sheet')} /><NavButton active={view === 'reminders'} icon={<Bell size={20} />} label="Tareas" onClick={() => setView('reminders')} /></nav>

      {assistantOpen && <div className="assistant-backdrop" onClick={() => setAssistantOpen(false)}><section className="assistant-panel" onClick={(event) => event.stopPropagation()}><div className="assistant-handle" /><div className="assistant-title-row"><div><p className="eyebrow">DJ NOA {aiOnline === true ? 'AI · ONLINE' : aiOnline === false ? '· MODO LOCAL' : 'AI · ...'}</p><h3>¿Qué hacemos?</h3></div><button className="icon-button" onClick={() => setAssistantOpen(false)}><X size={20} /></button></div><div className="assistant-reply"><Sparkles size={17} /><span>{assistantReply}</span></div><div className="command-box"><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runCommand(); }} placeholder="Ej. ¿qué tengo mañana?" /><button onClick={() => void runCommand()} disabled={busy || !command.trim()}><Send size={18} /></button></div><button className="speak-large" onClick={startListening} disabled={busy}><Mic size={22} /> {listening ? 'Escuchando...' : voiceActive ? 'Voz activa' : 'Decírmelo por voz'}</button></section></div>}
      {eventEditorOpen && <EventEditor event={selectedEvent} initialDate={eventCreateDate} onClose={() => { setEventEditorOpen(false); setSelectedEvent(null); setEventCreateDate(null); }} onSave={saveEvent} onDelete={deleteEvent} />}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}
