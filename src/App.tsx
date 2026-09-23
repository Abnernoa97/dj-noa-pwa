import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, FileSpreadsheet, Home, Mic, MicOff, Navigation, Plus, Send, Sparkles, X } from 'lucide-react';
import { addDays, addMonths, format, isAfter, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { askAssistant } from './assistant';
import { db, uid } from './db';
import type { AppView, AssistantAction, EventItem, ReminderItem, SheetRow } from './types';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

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

  const executeAction = async (action: AssistantAction) => {
    const now = new Date().toISOString();
    if (action.type === 'create_event') {
      await db.events.add({ id: uid(), title: action.title, date: action.date, time: action.time, venue: action.venue, address: action.address, notes: action.notes, status: 'confirmed', createdAt: now, updatedAt: now });
    }
    if (action.type === 'create_reminder') {
      await db.reminders.add({ id: uid(), title: action.title, dueAt: action.dueAt, done: false, createdAt: now });
    }
    if (action.type === 'add_sheet_row') {
      await db.sheetRows.add({ id: uid(), label: action.label, category: action.category, amount: action.amount, status: action.status || 'pending', notes: action.notes, createdAt: now });
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
        <div><p className="eyebrow">PERSONAL OPERATIONS</p><h1>DJ NOA</h1></div>
        <button className="status-pill" onClick={() => setAssistantOpen(true)}><Sparkles size={15} /> AI READY</button>
      </header>

      <main className="content">
        {view === 'home' && (
          <section className="home-view">
            <div className="hero-copy">
              <p>{format(new Date(), "EEEE, d 'de' MMMM", { locale: es }).toUpperCase()}</p>
              <h2>Todo lo importante,<br />sin perder tiempo.</h2>
            </div>

            <article className="glass-card next-event-card">
              <div className="card-heading"><span>PRÓXIMO EVENTO</span><CalendarDays size={19} /></div>
              {upcoming ? (
                <>
                  <div className="event-date-block"><strong>{format(parseISO(upcoming.date), 'dd')}</strong><span>{format(parseISO(upcoming.date), 'MMM', { locale: es }).toUpperCase()}</span></div>
                  <div className="event-main-copy">
                    <h3>{upcoming.title}</h3>
                    <p>{upcoming.time || 'Horario pendiente'}{upcoming.venue ? ` · ${upcoming.venue}` : ''}</p>
                    {(upcoming.address || upcoming.venue) && (
                      <a className="direction-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(upcoming.address || upcoming.venue || '')}`} target="_blank" rel="noreferrer"><Navigation size={16} /> CÓMO LLEGAR</a>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state"><p>No hay eventos próximos.</p><button onClick={() => setAssistantOpen(true)}><Plus size={16} /> Crear con voz</button></div>
              )}
            </article>

            <div className="quick-grid">
              <button className="glass-card quick-card" onClick={() => setView('calendar')}><CalendarDays size={22} /><span>Calendario</span><strong>{events.length}</strong></button>
              <button className="glass-card quick-card" onClick={() => setView('sheet')}><FileSpreadsheet size={22} /><span>Excel</span><strong>{money.format(total)}</strong></button>
              <button className="glass-card quick-card" onClick={() => setView('reminders')}><Bell size={22} /><span>Pendientes</span><strong>{openReminders}</strong></button>
            </div>
          </section>
        )}
        {view === 'calendar' && <CalendarView month={month} setMonth={setMonth} events={events} />}
        {view === 'sheet' && <SheetView rows={sheetRows} total={total} onExport={exportExcel} onAssistant={() => setAssistantOpen(true)} />}
        {view === 'reminders' && <RemindersView items={reminders} onToggle={toggleReminder} onAssistant={() => setAssistantOpen(true)} />}
      </main>

      <button className={`voice-orb ${listening ? 'listening' : ''}`} onClick={startListening} aria-label="Hablar con DJ NOA">{listening ? <MicOff size={28} /> : <Mic size={28} />}<span>{listening ? 'ESCUCHANDO' : 'HABLAR'}</span></button>

      <nav className="bottom-nav">
        <NavButton active={view === 'home'} icon={<Home size={20} />} label="Inicio" onClick={() => setView('home')} />
        <NavButton active={view === 'calendar'} icon={<CalendarDays size={20} />} label="Calendario" onClick={() => setView('calendar')} />
        <div className="nav-gap" />
        <NavButton active={view === 'sheet'} icon={<FileSpreadsheet size={20} />} label="Excel" onClick={() => setView('sheet')} />
        <NavButton active={view === 'reminders'} icon={<Bell size={20} />} label="Tareas" onClick={() => setView('reminders')} />
      </nav>

      {assistantOpen && (
        <div className="assistant-backdrop" onClick={() => setAssistantOpen(false)}>
          <section className="assistant-panel" onClick={(event) => event.stopPropagation()}>
            <div className="assistant-handle" />
            <div className="assistant-title-row"><div><p className="eyebrow">DJ NOA AI</p><h3>¿Qué hacemos?</h3></div><button className="icon-button" onClick={() => setAssistantOpen(false)}><X size={20} /></button></div>
            <div className="assistant-reply"><Sparkles size={17} /><span>{assistantReply}</span></div>
            <div className="command-box"><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runCommand(); }} placeholder="Ej. agrega $8,500 de transporte al Excel" /><button onClick={() => void runCommand()} disabled={busy || !command.trim()}><Send size={18} /></button></div>
            <button className="speak-large" onClick={startListening}><Mic size={22} /> {listening ? 'Escuchando...' : 'Decírmelo por voz'}</button>
          </section>
        </div>
      )}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function CalendarView({ month, setMonth, events }: { month: Date; setMonth: (date: Date) => void; events: EventItem[] }) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = start; days.length < 42; day = addDays(day, 1)) days.push(day);
  return (
    <section className="page-card calendar-page">
      <div className="page-title-row"><div><p className="eyebrow">AGENDA</p><h2>{format(month, 'MMMM yyyy', { locale: es })}</h2></div><div className="month-controls"><button onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></button><button onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></button></div></div>
      <div className="weekday-row">{['L','M','X','J','V','S','D'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const matches = events.filter((event) => event.date === dateKey);
          const outside = day.getMonth() !== month.getMonth();
          return <div key={dateKey} className={`calendar-day ${outside ? 'outside' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}><span>{format(day, 'd')}</span>{matches.slice(0, 2).map((event) => <small key={event.id}>{event.title}</small>)}</div>;
        })}
      </div>
      <p className="section-note">Toca el micrófono y di: “crea un evento el 18/11/2026”.</p>
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
