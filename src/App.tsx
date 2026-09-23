import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import type { AppView, AssistantAction, EventItem, ReminderItem, SheetColumn, SheetRow } from './types';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

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
  useEffect(() => scheduleReminderNotifications(reminders), [reminders]);

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

  const speakReply = (text: string) => {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 0.98;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const openEventEditor = (event?: EventItem) => {
    setSelectedEvent(event || null);
    setEventEditorOpen(true);
  };

  const saveEvent = async (draft: EventDraft) => {
    const now = new Date().toISOString();
    if (selectedEvent) await db.events.update(selectedEvent.id, { ...draft, updatedAt: now });
    else await db.events.add({ ...draft, id: uid(), createdAt: now, updatedAt: now });
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
    if (action.type === 'add_sheet_row') await db.sheetRows.add({ id: uid(), label: action.label, category: action.category, amount: action.amount, status: action.status || 'pending', notes: action.notes, eventId: action.eventId, values: action.values || {}, createdAt: now, updatedAt: now });
    if (action.type === 'update_sheet_row') {
      const current = await db.sheetRows.get(action.rowId);
      if (current) {
        const patch = { label: action.label, category: action.category, amount: action.amount, status: action.status, notes: action.notes, eventId: action.eventId, values: action.values ? { ...(current.values || {}), ...action.values } : undefined, updatedAt: now };
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

  const runCommand = async (text = command, speak = false) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const response = await askAssistant(clean, { events, reminders, sheetRows });
      for (const action of response.actions) await executeAction(action);
      await db.history.add({ id: uid(), command: clean, result: response.reply, createdAt: new Date().toISOString() });
      setAssistantReply(response.reply);
      setCommand('');
      if (speak) speakReply(response.reply);
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
    window.speechSynthesis?.cancel();
    const recognition = new Recognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setCommand(transcript);
      setAssistantOpen(true);
      void runCommand(transcript, true);
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

      <header className="topbar"><div><h1>DJ NOA</h1><p className="topbar-date">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p></div><button className="status-pill" onClick={() => setAssistantOpen(true)}><Sparkles size={15} /> IA</button></header>

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
        {view === 'calendar' && <CalendarWorkspace month={month} setMonth={setMonth} events={events} onOpenEvent={openEventEditor} />}
        {view === 'sheet' && <SheetWorkspace rows={sheetRows} events={events} onChanged={refresh} onAssistant={() => setAssistantOpen(true)} />}
        {view === 'reminders' && <ReminderWorkspace items={reminders} events={events} onChanged={refresh} onAssistant={() => setAssistantOpen(true)} />}
      </main>

      <button className={`voice-orb ${listening ? 'listening' : ''}`} onClick={startListening} aria-label="Hablar con DJ NOA">{listening ? <MicOff size={28} /> : <Mic size={28} />}<span>{listening ? 'ESCUCHANDO' : 'HABLAR'}</span></button>

      <nav className="bottom-nav"><NavButton active={view === 'home'} icon={<Home size={20} />} label="Inicio" onClick={() => setView('home')} /><NavButton active={view === 'events'} icon={<MapPin size={20} />} label="Eventos" onClick={() => setView('events')} /><NavButton active={view === 'calendar'} icon={<CalendarDays size={20} />} label="Calendario" onClick={() => setView('calendar')} /><NavButton active={view === 'sheet'} icon={<FileSpreadsheet size={20} />} label="Excel" onClick={() => setView('sheet')} /><NavButton active={view === 'reminders'} icon={<Bell size={20} />} label="Tareas" onClick={() => setView('reminders')} /></nav>

      {assistantOpen && <div className="assistant-backdrop" onClick={() => setAssistantOpen(false)}><section className="assistant-panel" onClick={(event) => event.stopPropagation()}><div className="assistant-handle" /><div className="assistant-title-row"><div><p className="eyebrow">DJ NOA AI</p><h3>¿Qué hacemos?</h3></div><button className="icon-button" onClick={() => setAssistantOpen(false)}><X size={20} /></button></div><div className="assistant-reply"><Sparkles size={17} /><span>{assistantReply}</span></div><div className="command-box"><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runCommand(); }} placeholder="Ej. ¿qué tengo mañana?" /><button onClick={() => void runCommand()} disabled={busy || !command.trim()}><Send size={18} /></button></div><button className="speak-large" onClick={startListening}><Mic size={22} /> {listening ? 'Escuchando...' : 'Decírmelo por voz'}</button></section></div>}
      {eventEditorOpen && <EventEditor event={selectedEvent} onClose={() => { setEventEditorOpen(false); setSelectedEvent(null); }} onSave={saveEvent} onDelete={deleteEvent} />}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}
