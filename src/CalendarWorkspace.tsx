import { useMemo, useState } from 'react';
import { addDays, addMonths, format, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, ChevronLeft, ChevronRight, FileSpreadsheet, MapPin, Plus, X } from 'lucide-react';
import type { EventItem, ReminderItem, SheetRow } from './types';

type CalendarMode = 'month' | 'week' | 'day';

type Props = {
  month: Date;
  setMonth: (date: Date) => void;
  events: EventItem[];
  reminders: ReminderItem[];
  sheetRows: SheetRow[];
  onOpenEvent: (event: EventItem) => void;
  onCreateEvent: (date: string) => void;
  onToggleReminder: (item: ReminderItem) => Promise<void> | void;
  onOpenReminders: () => void;
  onOpenSheetRow: (rowId?: string) => void;
};

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

function dateKeyFromIso(value?: string) {
  if (!value) return null;
  try { return format(parseISO(value), 'yyyy-MM-dd'); } catch { return null; }
}

export default function CalendarWorkspace({ month, setMonth, events, reminders, sheetRows, onOpenEvent, onCreateEvent, onToggleReminder, onOpenReminders, onOpenSheetRow }: Props) {
  const [mode, setMode] = useState<CalendarMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [summaryOpen, setSummaryOpen] = useState(false);

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  const reminderDate = (item: ReminderItem) => dateKeyFromIso(item.dueAt) || (item.eventId ? eventById.get(item.eventId)?.date || null : null);
  const sheetDate = (row: SheetRow) => row.calendarDate || (row.eventId ? eventById.get(row.eventId)?.date || null : null);

  const itemsForDate = (dateKey: string) => {
    const dayEvents = events.filter((event) => event.date === dateKey).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    const dayReminders = reminders.filter((item) => reminderDate(item) === dateKey).sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999'));
    const dayRows = sheetRows.filter((row) => sheetDate(row) === dateKey);
    return { events: dayEvents, reminders: dayReminders, rows: dayRows };
  };

  const monthStart = startOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays: Date[] = [];
  for (let day = gridStart; monthDays.length < 42; day = addDays(day, 1)) monthDays.push(day);

  const weekStart = startOfWeek(month, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const activeDay = mode === 'month' ? selectedDate : month;
  const activeDateKey = format(activeDay, 'yyyy-MM-dd');
  const activeItems = itemsForDate(activeDateKey);

  const visibleMonthKey = format(month, 'yyyy-MM');
  const monthEvents = events.filter((event) => event.date.startsWith(visibleMonthKey));
  const monthReminders = reminders.filter((item) => reminderDate(item)?.startsWith(visibleMonthKey));
  const monthRows = sheetRows.filter((row) => sheetDate(row)?.startsWith(visibleMonthKey));
  const monthFinanceTotal = monthRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

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

  const openDay = (day: Date, openSummary = true) => {
    setSelectedDate(day);
    if (day.getMonth() !== month.getMonth() || day.getFullYear() !== month.getFullYear()) setMonth(day);
    if (mode !== 'month') setMonth(day);
    if (openSummary) setSummaryOpen(true);
  };

  return (
    <section className="page-card calendar-page calendar-integrated">
      <div className="calendar-topline">
        <div className="calendar-title-wrap"><p className="eyebrow">TODO EN UN SOLO DÍA</p><h2>{title}</h2></div>
        <div className="calendar-actions"><button className="calendar-today-button" onClick={goToday}>Hoy</button><button className="calendar-nav-button" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button><button className="calendar-nav-button" onClick={() => move(1)} aria-label="Siguiente"><ChevronRight size={18} /></button></div>
      </div>

      <div className="calendar-overview">
        <div><span>EVENTOS</span><strong>{monthEvents.length}</strong></div>
        <div><span>TAREAS</span><strong>{monthReminders.filter((item) => !item.done).length}</strong></div>
        <div><span>EXCEL</span><strong>{money.format(monthFinanceTotal)}</strong></div>
      </div>

      <div className="calendar-legend"><span><i className="event" /> Eventos</span><span><i className="task" /> Tareas</span><span><i className="sheet" /> Excel</span></div>

      <div className="calendar-view-switch"><button className={mode === 'month' ? 'active' : ''} onClick={() => selectMode('month')}>Mes</button><button className={mode === 'week' ? 'active' : ''} onClick={() => selectMode('week')}>Semana</button><button className={mode === 'day' ? 'active' : ''} onClick={() => selectMode('day')}>Día</button></div>

      {mode === 'month' && <><div className="weekday-row">{['L','M','X','J','V','S','D'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid calendar-grid-rich">{monthDays.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const bundle = itemsForDate(dateKey);
        const outside = day.getMonth() !== month.getMonth();
        const selected = isSameDay(day, selectedDate);
        const totalItems = bundle.events.length + bundle.reminders.length + bundle.rows.length;
        return <button key={dateKey} className={`calendar-day rich-day ${outside ? 'outside' : ''} ${isSameDay(day, new Date()) ? 'today' : ''} ${selected ? 'selected' : ''}`} onClick={() => openDay(day)}><span className="rich-day-number">{format(day, 'd')}</span><div className="rich-day-dots">{bundle.events.length > 0 && <i className="event" />}{bundle.reminders.length > 0 && <i className="task" />}{bundle.rows.length > 0 && <i className="sheet" />}</div>{totalItems > 0 && <small>{totalItems}</small>}</button>;
      })}</div></>}

      {mode === 'week' && <div className="calendar-week rich-week">{weekDays.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const bundle = itemsForDate(dateKey);
        const firstEvent = bundle.events[0];
        return <button key={dateKey} className={`week-day ${isSameDay(day, new Date()) ? 'today' : ''} ${isSameDay(day, selectedDate) ? 'selected' : ''}`} onClick={() => openDay(day)}><div className="week-day-head"><span>{format(day, 'EEE', { locale: es })}</span><strong>{format(day, 'd')}</strong></div><div className="week-counts"><span className="event">{bundle.events.length}</span><span className="task">{bundle.reminders.length}</span><span className="sheet">{bundle.rows.length}</span></div>{firstEvent ? <div className="week-preview"><strong>{firstEvent.title}</strong><span>{firstEvent.time || 'Sin hora'}</span></div> : <div className="week-empty">Sin eventos</div>}</button>;
      })}</div>}

      {mode === 'day' && <DaySummary date={month} events={activeItems.events} reminders={activeItems.reminders} rows={activeItems.rows} onOpenEvent={onOpenEvent} onToggleReminder={onToggleReminder} onOpenReminders={onOpenReminders} onOpenSheetRow={onOpenSheetRow} onCreateEvent={onCreateEvent} />}

      {mode !== 'day' && <button className="calendar-selected-preview" onClick={() => setSummaryOpen(true)}><span>{format(selectedDate, "EEE d MMM", { locale: es })}</span><strong>{activeItems.events.length + activeItems.reminders.length + activeItems.rows.length} elementos</strong><ChevronRight size={16} /></button>}

      {summaryOpen && <div className="calendar-summary-backdrop" onClick={() => setSummaryOpen(false)}><section className="calendar-summary-sheet" onClick={(event) => event.stopPropagation()}><div className="calendar-summary-handle" /><button className="calendar-summary-close" onClick={() => setSummaryOpen(false)}><X size={19} /></button><DaySummary date={selectedDate} events={activeItems.events} reminders={activeItems.reminders} rows={activeItems.rows} onOpenEvent={(event) => { setSummaryOpen(false); onOpenEvent(event); }} onToggleReminder={onToggleReminder} onOpenReminders={() => { setSummaryOpen(false); onOpenReminders(); }} onOpenSheetRow={(id) => { setSummaryOpen(false); onOpenSheetRow(id); }} onCreateEvent={(date) => { setSummaryOpen(false); onCreateEvent(date); }} /></section></div>}
    </section>
  );
}

function DaySummary({ date, events, reminders, rows, onOpenEvent, onToggleReminder, onOpenReminders, onOpenSheetRow, onCreateEvent }: { date: Date; events: EventItem[]; reminders: ReminderItem[]; rows: SheetRow[]; onOpenEvent: (event: EventItem) => void; onToggleReminder: (item: ReminderItem) => Promise<void> | void; onOpenReminders: () => void; onOpenSheetRow: (rowId?: string) => void; onCreateEvent: (date: string) => void }) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const financeTotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const empty = !events.length && !reminders.length && !rows.length;

  return <div className="day-summary">
    <header className="day-summary-head"><div className="day-summary-date"><strong>{format(date, 'dd')}</strong><div><span>{format(date, 'MMMM', { locale: es })}</span><b>{format(date, 'EEEE', { locale: es })}</b></div></div><button onClick={() => onCreateEvent(dateKey)}><Plus size={15} /> Evento</button></header>

    <div className="day-summary-metrics"><div><span>EVENTOS</span><strong>{events.length}</strong></div><div><span>TAREAS</span><strong>{reminders.length}</strong></div><div><span>EXCEL</span><strong>{money.format(financeTotal)}</strong></div></div>

    {empty && <div className="day-summary-empty"><span>Este día está limpio.</span><small>Cuando agregues un evento, recordatorio o movimiento relacionado, aparecerá aquí automáticamente.</small></div>}

    {events.length > 0 && <section className="day-summary-section"><div className="day-summary-label"><MapPin size={14} /><span>EVENTOS</span></div>{events.map((event) => <button className="day-summary-item event-item" key={event.id} onClick={() => onOpenEvent(event)}><span className="summary-time">{event.time || '—'}</span><span className="summary-copy"><strong>{event.title}</strong><span>{event.venue || 'Lugar pendiente'}</span></span><ChevronRight size={15} /></button>)}</section>}

    {reminders.length > 0 && <section className="day-summary-section"><div className="day-summary-label"><Bell size={14} /><span>TAREAS Y RECORDATORIOS</span><button onClick={onOpenReminders}>Ver todo</button></div>{reminders.map((item) => <div className={`day-summary-item task-item ${item.done ? 'done' : ''}`} key={item.id}><button className="summary-task-check" onClick={() => void onToggleReminder(item)}>{item.done ? '✓' : ''}</button><button className="summary-copy" onClick={onOpenReminders}><strong>{item.title}</strong><span>{item.dueAt ? format(parseISO(item.dueAt), 'HH:mm') : 'Vinculado al evento'}{item.priority === 'high' ? ' · Alta prioridad' : ''}</span></button></div>)}</section>}

    {rows.length > 0 && <section className="day-summary-section"><div className="day-summary-label"><FileSpreadsheet size={14} /><span>EXCEL RELACIONADO</span><button onClick={() => onOpenSheetRow()}>Ver Excel</button></div>{rows.map((row) => <button className="day-summary-item sheet-item" key={row.id} onClick={() => onOpenSheetRow(row.id)}><span className="summary-copy"><strong>{row.label}</strong><span>{row.category}{row.status === 'paid' ? ' · Pagado' : row.status === 'pending' ? ' · Pendiente' : ''}</span></span><span className="summary-money">{money.format(row.amount)}</span><ChevronRight size={15} /></button>)}</section>}
  </div>;
}
