import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, FileSpreadsheet, Home, MapPin, Mic, MicOff, Navigation, Plus, Save, Send, Sparkles, Trash2, X } from 'lucide-react';
import { addDays, addMonths, format, isAfter, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { askAssistant } from './assistant';
import { db, uid } from './db';
import type { AppView, AssistantAction, EventItem, EventStatus, ReminderItem, SheetRow } from './types';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

type EventDraft = Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>;
type CalendarMode = 'month' | 'week' | 'day';

function safeDate(value?: string) {
  if (!value) return null;
  try { return parseISO(value); } catch { return null; }
}

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [assistantReply, setAssistantReply] = useState('Dime qué necesitas y lo hago.');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
  const focusReminders = useMemo(() => reminders.filter((item) => !item.done).slice(0, 3), [reminders]);
  const todayEventCount = useMemo(() => events.filter((item) => item.date === format(new Date(), 'yyyy-MM-dd')).length, [events]);

  const openEventEditor = (event?: EventItem) => {
    setSelectedEvent(event || null);
    setEventEditorOpen(true);
  };

  const saveEvent = async (draft: EventDraft) => {
    const now = new Date().toISOString();
    if (selectedEvent) {
      await db.events.update(selectedEvent.id, { ...draft, updatedAt: now });
    } else {
      await db.events.add({ ...draft, id: uid(), createdAt: now, updatedAt: now });
    }
    setEventEditorOpen(false);
    setSelectedEvent(null);
    await refresh();
  };

  const deleteEvent = async () => {
    if (!selectedEvent) return;
    await db.events.delete(selectedEvent.id);
    setEventEditorOpen(false);
    setSelectedEvent(null);
    await refresh();
  };

  const executeAction = async (action: AssistantAction) => {
    const now = new Date().toISOString();
    if (action.type === 'create_event') {
      await db.events.add({ id: uid(), title: action.title, date: action.date, time: action.time, venue: action.venue, address: action.address, notes: action.notes, status: action.status || 'confirmed', createdAt: now, updatedAt: now });
    }
    if (action.type === 'update_event') {
      const patch = { title: action.title, date: action.date, time: action.time, venue: action.venue, address: action.address, notes: action.notes, status: action.status, updatedAt: now };
      await db.events.update(action.eventId, Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)));
    }
    if (action.type === 'delete_event') await db.events.delete(action.eventId);
    if (action.type === 'create_reminder') {
      await db.reminders.add({ id: uid(), title: action.title, dueAt: action.dueAt, done: false, eventId: action.eventId, createdAt: now });
    }
    if (action.type === 'add_sheet_row') {
      await db.sheetRows.add({ id: uid(), label: action.label, category: action.category, amount: action.amount, status: action.status || 'pending', notes: action.notes, eventId: action.eventId, createdAt: now });
    }
    if (action.type === 'navigate') setView(action.view);
  };

  const runCommand = async (text = command) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const response = await askAssistant(clean, { events, reminders, sheetRows });
      for (const action of response.actions) await executeAction(action);
      await db.history.add({ id: uid(), command: clean, result: response.reply, createdAt: new Date().toISOString() });
      setAssistantReply(response.reply);
      setCommand('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setAssistantReply('Este navegador no permite reconocimiento de voz. Puedes escribir el comando.');
      setAssistantOpen(true);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setCommand(transcript);
      setAssistantOpen(true);
      void runCommand(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      setAssistantReply('No pude escuchar bien. Inténtalo otra vez.');
      setAssistantOpen(true);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const toggleReminder = async (item: ReminderItem) => {
    await db.reminders.update(item.id, { done: !item.done });
    await refresh();
  };

  const exportExcel = () => {
    const rows = sheetRows.map((row) => ({ Concepto: row.label, Categoría: row.category, Monto: row.amount, Estado: row.status, Notas: row.notes || '', Fecha: row.createdAt.slice(0, 10) }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DJ NOA');
    XLSX.writeFile(wb, `DJ-NOA-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="app-shell">
      <div className="background-photo" aria-hidden="true" />
      <div className="background-shade" aria-hidden="true" />

      <header className="topbar">
        <div>
          <h1>DJ NOA</h1>
          <p className="topbar-date">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p>
        </div>
        <button className="status-pill" onClick={() => setAssistantOpen(true)}><Sparkles size={15} /> IA</button>
      </header>

      <main className="content">
        {view === 'home' && (
          <section className="home-view">
            <div className="home-summary">
              <div>
                <span>HOY</span>
                <strong>{todayEventCount ? `${todayEventCount} evento${todayEventCount > 1 ? 's' : ''}` : 'Sin eventos hoy'}</strong>
              </div>
              <button onClick={startListening}><Mic size={18} /> Hablar con DJ NOA</button>
            </div>

            <article className="glass-card next-event-card">
              <div className="card-heading"><span>PRÓXIMO EVENTO</span><CalendarDays size={19} /></div>
              {upcoming ? (
                <>
                  <div className="event-date-block"><strong>{format(parseISO(upcoming.date), 'dd')}</strong><span>{format(parseISO(upcoming.date), 'MMM', { locale: es }).toUpperCase()}</span></div>
                  <div className="event-main-copy">
                    <h3>{upcoming.title}</h3>
                    <p>{upcoming.time || 'Horario pendiente'}{upcoming.venue ? ` · ${upcoming.venue}` : ''}</p>
                    <div className="event-home-actions">
                      {(upcoming.address || upcoming.venue) && <a className="direction-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(upcoming.address || upcoming.venue || '')}`} target="_blank" rel="noreferrer"><Navigation size={16} /> Cómo llegar</a>}
                      <button className="event-detail-link" onClick={() => openEventEditor(upcoming)}>Detalles</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state"><p>No hay eventos próximos.</p><button onClick={() => openEventEditor()}><Plus size={16} /> Crear evento</button></div>
              )}
            </article>

            <div className="section-label-row"><span>ACCESOS RÁPIDOS</span></div>
            <div className="quick-grid">
              <button className="glass-card quick-card" onClick={() => setView('events')}><div className="quick-icon"><MapPin size={21} /></div><div><span>Eventos</span><strong>{events.length} registrados</strong></div></button>
              <button className="glass-card quick-card" onClick={() => setView('calendar')}><div className="quick-icon"><CalendarDays size={21} /></div><div><span>Calendario</span><strong>{events.length} eventos</strong></div></button>
              <button className="glass-card quick-card" onClick={() => setView('sheet')}><div className="quick-icon"><FileSpreadsheet size={21} /></div><div><span>Excel</span><strong>{money.format(total)}</strong></div></button>
              <button className="glass-card quick-card" onClick={() => setView('reminders')}><div className="quick-icon"><Bell size={21} /></div><div><span>Recordatorios</span><strong>{openReminders} pendientes</strong></div></button>
            </div>

            <div className="section-label-row"><span>LO SIGUIENTE</span><button onClick={() => setView('reminders')}>Ver todo</button></div>
            <div className="focus-list">
              {focusReminders.length ? focusReminders.map((item) => (
                <button key={item.id} className="focus-row" onClick={() => void toggleReminder(item)}>
                  <span className="focus-check" />
                  <div><strong>{item.title}</strong><small>{item.dueAt ? format(parseISO(item.dueAt), "d MMM · HH:mm", { locale: es }) : 'Sin fecha'}</small></div>
                </button>
              )) : <div className="focus-empty">Nada pendiente por ahora.</div>}
            </div>
          </section>
        )}
        {view === 'events' && <EventsView events={events} onOpen={openEventEditor} onCreate={() => openEventEditor()} />}
        {view === 'calendar' && <CalendarView month={month} setMonth={setMonth} events={events} onOpenEvent={openEventEditor} />}
        {view === 'sheet' && <SheetView rows={sheetRows} total={total} onExport={exportExcel} onAssistant={() => setAssistantOpen(true)} />}
        {view === 'reminders' && <RemindersView items={reminders} onToggle={toggleReminder} onAssistant={() => setAssistantOpen(true)} />}
      </main>

      <button className={`voice-orb ${listening ? 'listening' : ''}`} onClick={startListening} aria-label="Hablar con DJ NOA">{listening ? <MicOff size={28} /> : <Mic size={28} />}<span>{listening ? 'ESCUCHANDO' : 'HABLAR'}</span></button>

      <nav className="bottom-nav">
        <NavButton active={view === 'home'} icon={<Home size={20} />} label="Inicio" onClick={() => setView('home')} />
        <NavButton active={view === 'events'} icon={<MapPin size={20} />} label="Eventos" onClick={() => setView('events')} />
        <NavButton active={view === 'calendar'} icon={<CalendarDays size={20} />} label="Calendario" onClick={() => setView('calendar')} />
        <NavButton active={view === 'sheet'} icon={<FileSpreadsheet size={20} />} label="Excel" onClick={() => setView('sheet')} />
        <NavButton active={view === 'reminders'} icon={<Bell size={20} />} label="Tareas" onClick={() => setView('reminders')} />
      </nav>

      {assistantOpen && (
        <div className="assistant-backdrop" onClick={() => setAssistantOpen(false)}>
          <section className="assistant-panel" onClick={(event) => event.stopPropagation()}>
            <div className="assistant-handle" />
            <div className="assistant-title-row"><div><p className="eyebrow">DJ NOA AI</p><h3>¿Qué hacemos?</h3></div><button className="icon-button" onClick={() => setAssistantOpen(false)}><X size={20} /></button></div>
            <div className="assistant-reply"><Sparkles size={17} /><span>{assistantReply}</span></div>
            <div className="command-box"><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runCommand(); }} placeholder="Ej. mueve el próximo evento al 28/09/2026" /><button onClick={() => void runCommand()} disabled={busy || !command.trim()}><Send size={18} /></button></div>
            <button className="speak-large" onClick={startListening}><Mic size={22} /> {listening ? 'Escuchando...' : 'Decírmelo por voz'}</button>
          </section>
        </div>
      )}

      {eventEditorOpen && <EventEditor event={selectedEvent} onClose={() => { setEventEditorOpen(false); setSelectedEvent(null); }} onSave={saveEvent} onDelete={deleteEvent} />}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function EventsView({ events, onOpen, onCreate }: { events: EventItem[]; onOpen: (event: EventItem) => void; onCreate: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const sorted = [...events].sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`));
  const upcoming = sorted.filter((event) => event.date >= today && event.status !== 'done');
  const history = sorted.filter((event) => event.date < today || event.status === 'done').reverse();
  return (
    <section className="page-card events-page">
      <div className="page-title-row">
        <div><p className="eyebrow">AGENDA PERSONAL</p><h2>Eventos</h2></div>
        <button className="round-plus" onClick={onCreate}><Plus size={20} /></button>
      </div>
      <div className="events-section-label">PRÓXIMOS</div>
      <div className="event-list">
        {upcoming.length ? upcoming.map((event) => <EventRow key={event.id} event={event} onOpen={onOpen} />) : <div className="empty-table">No hay eventos próximos.</div>}
      </div>
      {history.length > 0 && <>
        <div className="events-section-label history-label">HISTORIAL</div>
        <div className="event-list history-list">{history.map((event) => <EventRow key={event.id} event={event} onOpen={onOpen} />)}</div>
      </>}
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

function EventEditor({ event, onClose, onSave, onDelete }: { event: EventItem | null; onClose: () => void; onSave: (draft: EventDraft) => Promise<void>; onDelete: () => Promise<void> }) {
  const [draft, setDraft] = useState<EventDraft>(() => ({
    title: event?.title || '',
    date: event?.date || format(new Date(), 'yyyy-MM-dd'),
    time: event?.time || '',
    venue: event?.venue || '',
    address: event?.address || '',
    notes: event?.notes || '',
    status: event?.status || 'confirmed'
  }));
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

function CalendarView({ month, setMonth, events, onOpenEvent }: { month: Date; setMonth: (date: Date) => void; events: EventItem[]; onOpenEvent: (event: EventItem) => void }) {
  const [mode, setMode] = useState<CalendarMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const monthStart = startOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays: Date[] = [];
  for (let day = gridStart; monthDays.length < 42; day = addDays(day, 1)) monthDays.push(day);

  const weekStart = startOfWeek(month, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const activeDay = mode === 'month' ? selectedDate : month;
  const activeDateKey = format(activeDay, 'yyyy-MM-dd');
  const dayEvents = events
    .filter((event) => event.date === activeDateKey)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const upcomingAgenda = [...events]
    .filter((event) => event.date >= todayKey && event.status !== 'done')
    .sort((a, b) => `${a.date}T${a.time || '99:99'}`.localeCompare(`${b.date}T${b.time || '99:99'}`))
    .slice(0, 5);

  const title = mode === 'month'
    ? format(month, 'MMMM yyyy', { locale: es })
    : mode === 'week'
      ? `${format(weekStart, 'd MMM', { locale: es })} — ${format(addDays(weekStart, 6), 'd MMM', { locale: es })}`
      : format(month, "EEEE d 'de' MMMM", { locale: es });

  const move = (direction: -1 | 1) => {
    if (mode === 'month') setMonth(addMonths(month, direction));
    if (mode === 'week') setMonth(addDays(month, 7 * direction));
    if (mode === 'day') setMonth(addDays(month, direction));
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setMonth(mode === 'month' ? startOfMonth(now) : now);
  };

  const selectMode = (next: CalendarMode) => {
    setMode(next);
    if (next !== 'month') setMonth(selectedDate);
  };

  const selectDay = (day: Date) => {
    setSelectedDate(day);
    if (day.getMonth() !== month.getMonth() || day.getFullYear() !== month.getFullYear()) setMonth(day);
  };

  return (
    <section className="page-card calendar-page">
      <div className="calendar-topline">
        <div className="calendar-title-wrap"><p className="eyebrow">AGENDA</p><h2>{title}</h2></div>
        <div className="calendar-actions">
          <button className="calendar-today-button" onClick={goToday}>Hoy</button>
          <button className="calendar-nav-button" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
          <button className="calendar-nav-button" onClick={() => move(1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="calendar-view-switch">
        <button className={mode === 'month' ? 'active' : ''} onClick={() => selectMode('month')}>Mes</button>
        <button className={mode === 'week' ? 'active' : ''} onClick={() => selectMode('week')}>Semana</button>
        <button className={mode === 'day' ? 'active' : ''} onClick={() => selectMode('day')}>Día</button>
      </div>

      {mode === 'month' && <>
        <div className="weekday-row">{['L','M','X','J','V','S','D'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {monthDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const matches = events.filter((event) => event.date === dateKey);
            const outside = day.getMonth() !== month.getMonth();
            const selected = isSameDay(day, selectedDate);
            return (
              <div key={dateKey} className={`calendar-day ${outside ? 'outside' : ''} ${isSameDay(day, new Date()) ? 'today' : ''} ${selected ? 'selected' : ''}`} onClick={() => selectDay(day)}>
                <span>{format(day, 'd')}</span>
                {matches.slice(0, 2).map((event) => <button className="calendar-event-button" key={event.id} onClick={(e) => { e.stopPropagation(); onOpenEvent(event); }}>{event.title}</button>)}
                {matches.length > 2 && <small className="calendar-more">+{matches.length - 2}</small>}
              </div>
            );
          })}
        </div>
      </>}

      {mode === 'week' && (
        <div className="calendar-week">
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const matches = events.filter((event) => event.date === dateKey).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
            return (
              <div key={dateKey} className={`week-day ${isSameDay(day, new Date()) ? 'today' : ''} ${isSameDay(day, selectedDate) ? 'selected' : ''}`} onClick={() => { setSelectedDate(day); setMonth(day); }}>
                <div className="week-day-head"><span>{format(day, 'EEE', { locale: es })}</span><strong>{format(day, 'd')}</strong></div>
                {matches.length ? matches.map((event) => <button className="week-event" key={event.id} onClick={(e) => { e.stopPropagation(); onOpenEvent(event); }}><strong>{event.title}</strong><span>{event.time || 'Sin hora'}</span></button>) : <div className="week-empty">Libre</div>}
              </div>
            );
          })}
        </div>
      )}

      {mode === 'day' && (
        <div className="calendar-day-view">
          <div className="day-date-hero">
            <strong>{format(month, 'dd')}</strong>
            <div><span>{format(month, 'MMMM', { locale: es })}</span><b>{format(month, 'EEEE', { locale: es })}</b></div>
          </div>
          <div className="day-event-list">
            {dayEvents.length ? dayEvents.map((event) => (
              <button className="day-event" key={event.id} onClick={() => onOpenEvent(event)}>
                <span className="day-event-time">{event.time || '—'}</span>
                <span className="day-event-copy"><strong>{event.title}</strong><span>{event.venue || 'Lugar pendiente'}</span></span>
                <span className={`day-event-status ${event.status}`} />
              </button>
            )) : <div className="day-empty">No hay eventos este día.</div>}
          </div>
        </div>
      )}

      <div className="calendar-agenda">
        <div className="calendar-agenda-head"><span>PRÓXIMOS EVENTOS</span><small>{upcomingAgenda.length} visibles</small></div>
        <div className="calendar-agenda-list">
          {upcomingAgenda.length ? upcomingAgenda.map((event) => (
            <button className="agenda-event" key={event.id} onClick={() => onOpenEvent(event)}>
              <span className="agenda-date"><strong>{format(parseISO(event.date), 'dd')}</strong><span>{format(parseISO(event.date), 'MMM', { locale: es }).toUpperCase()}</span></span>
              <span className="agenda-copy"><strong>{event.title}</strong><span>{event.time || 'Sin hora'}{event.venue ? ` · ${event.venue}` : ''}</span></span>
              <ChevronRight className="agenda-chevron" size={17} />
            </button>
          )) : <div className="day-empty">No hay eventos próximos.</div>}
        </div>
      </div>

      <p className="section-note">Toca cualquier evento para editarlo. El botón Hoy te devuelve al día actual.</p>
    </section>
  );
}

function SheetView({ rows, total, onExport, onAssistant }: { rows: SheetRow[]; total: number; onExport: () => void; onAssistant: () => void }) {
  return (
    <section className="page-card">
      <div className="page-title-row"><div><p className="eyebrow">OPERACIONES</p><h2>Excel</h2></div><button className="secondary-button" onClick={onExport}>Exportar .xlsx</button></div>
      <div className="total-banner"><span>TOTAL REGISTRADO</span><strong>{money.format(total)}</strong></div>
      <div className="table-wrap"><div className="sheet-table sheet-head"><span>Concepto</span><span>Categoría</span><span>Monto</span><span>Estado</span></div>{rows.length ? rows.map((row) => <div className="sheet-table" key={row.id}><span>{row.label}</span><span>{row.category}</span><span>{money.format(row.amount)}</span><span className={`status ${row.status}`}>{row.status}</span></div>) : <div className="empty-table">Aún no hay movimientos.</div>}</div>
      <button className="full-action" onClick={onAssistant}><Mic size={18} /> Agregar con voz</button>
    </section>
  );
}

function RemindersView({ items, onToggle, onAssistant }: { items: ReminderItem[]; onToggle: (item: ReminderItem) => void; onAssistant: () => void }) {
  return (
    <section className="page-card">
      <div className="page-title-row"><div><p className="eyebrow">FOCUS</p><h2>Recordatorios</h2></div><button className="round-plus" onClick={onAssistant}><Plus size={20} /></button></div>
      <div className="reminder-list">{items.length ? items.map((item) => <button key={item.id} className={`reminder-row ${item.done ? 'done' : ''}`} onClick={() => onToggle(item)}><span className="check-circle">{item.done && <Check size={15} />}</span><div><strong>{item.title}</strong><small>{item.dueAt ? format(parseISO(item.dueAt), "d MMM · HH:mm", { locale: es }) : 'Sin fecha'}</small></div></button>) : <div className="empty-table">Nada pendiente. Buenísimo.</div>}</div>
    </section>
  );
}
