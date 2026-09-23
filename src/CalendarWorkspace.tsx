import { useState } from 'react';
import { addDays, addMonths, format, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { EventItem } from './types';

type CalendarMode = 'month' | 'week' | 'day';

export default function CalendarWorkspace({ month, setMonth, events, onOpenEvent }: { month: Date; setMonth: (date: Date) => void; events: EventItem[]; onOpenEvent: (event: EventItem) => void }) {
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
  const dayEvents = events.filter((event) => event.date === activeDateKey).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const upcomingAgenda = [...events].filter((event) => event.date >= todayKey && event.status !== 'done').sort((a, b) => `${a.date}T${a.time || '99:99'}`.localeCompare(`${b.date}T${b.time || '99:99'}`)).slice(0, 5);

  const title = mode === 'month' ? format(month, 'MMMM yyyy', { locale: es }) : mode === 'week' ? `${format(weekStart, 'd MMM', { locale: es })} — ${format(addDays(weekStart, 6), 'd MMM', { locale: es })}` : format(month, "EEEE d 'de' MMMM", { locale: es });

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
        <div className="calendar-actions"><button className="calendar-today-button" onClick={goToday}>Hoy</button><button className="calendar-nav-button" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button><button className="calendar-nav-button" onClick={() => move(1)} aria-label="Siguiente"><ChevronRight size={18} /></button></div>
      </div>

      <div className="calendar-view-switch"><button className={mode === 'month' ? 'active' : ''} onClick={() => selectMode('month')}>Mes</button><button className={mode === 'week' ? 'active' : ''} onClick={() => selectMode('week')}>Semana</button><button className={mode === 'day' ? 'active' : ''} onClick={() => selectMode('day')}>Día</button></div>

      {mode === 'month' && <><div className="weekday-row">{['L','M','X','J','V','S','D'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{monthDays.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const matches = events.filter((event) => event.date === dateKey);
        const outside = day.getMonth() !== month.getMonth();
        const selected = isSameDay(day, selectedDate);
        return <div key={dateKey} className={`calendar-day ${outside ? 'outside' : ''} ${isSameDay(day, new Date()) ? 'today' : ''} ${selected ? 'selected' : ''}`} onClick={() => selectDay(day)}><span>{format(day, 'd')}</span>{matches.slice(0, 2).map((event) => <button className="calendar-event-button" key={event.id} onClick={(e) => { e.stopPropagation(); onOpenEvent(event); }}>{event.title}</button>)}{matches.length > 2 && <small className="calendar-more">+{matches.length - 2}</small>}</div>;
      })}</div></>}

      {mode === 'week' && <div className="calendar-week">{weekDays.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const matches = events.filter((event) => event.date === dateKey).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
        return <div key={dateKey} className={`week-day ${isSameDay(day, new Date()) ? 'today' : ''} ${isSameDay(day, selectedDate) ? 'selected' : ''}`} onClick={() => { setSelectedDate(day); setMonth(day); }}><div className="week-day-head"><span>{format(day, 'EEE', { locale: es })}</span><strong>{format(day, 'd')}</strong></div>{matches.length ? matches.map((event) => <button className="week-event" key={event.id} onClick={(e) => { e.stopPropagation(); onOpenEvent(event); }}><strong>{event.title}</strong><span>{event.time || 'Sin hora'}</span></button>) : <div className="week-empty">Libre</div>}</div>;
      })}</div>}

      {mode === 'day' && <div className="calendar-day-view"><div className="day-date-hero"><strong>{format(month, 'dd')}</strong><div><span>{format(month, 'MMMM', { locale: es })}</span><b>{format(month, 'EEEE', { locale: es })}</b></div></div><div className="day-event-list">{dayEvents.length ? dayEvents.map((event) => <button className="day-event" key={event.id} onClick={() => onOpenEvent(event)}><span className="day-event-time">{event.time || '—'}</span><span className="day-event-copy"><strong>{event.title}</strong><span>{event.venue || 'Lugar pendiente'}</span></span><span className={`day-event-status ${event.status}`} /></button>) : <div className="day-empty">No hay eventos este día.</div>}</div></div>}

      <div className="calendar-agenda"><div className="calendar-agenda-head"><span>PRÓXIMOS EVENTOS</span><small>{upcomingAgenda.length} visibles</small></div><div className="calendar-agenda-list">{upcomingAgenda.length ? upcomingAgenda.map((event) => <button className="agenda-event" key={event.id} onClick={() => onOpenEvent(event)}><span className="agenda-date"><strong>{format(parseISO(event.date), 'dd')}</strong><span>{format(parseISO(event.date), 'MMM', { locale: es }).toUpperCase()}</span></span><span className="agenda-copy"><strong>{event.title}</strong><span>{event.time || 'Sin hora'}{event.venue ? ` · ${event.venue}` : ''}</span></span><ChevronRight className="agenda-chevron" size={17} /></button>) : <div className="day-empty">No hay eventos próximos.</div>}</div></div>
      <p className="section-note">Toca cualquier evento para editarlo. El botón Hoy te devuelve al día actual.</p>
    </section>
  );
}
