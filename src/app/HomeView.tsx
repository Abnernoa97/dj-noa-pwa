import { Bell, CalendarDays, FileSpreadsheet, MapPin, Mic } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AppView, EventItem, ReminderItem } from '../types';
import { money } from './assistantActions';

type Props = {
  todayEventCount: number;
  upcoming: EventItem | undefined;
  eventCount: number;
  total: number;
  openReminders: number;
  focusReminders: ReminderItem[];
  onVoice: () => void;
  onView: (view: AppView) => void;
  onOpenMlb: () => void;
  onOpenEvent: (event: EventItem) => void;
  onCreateEvent: () => void;
  onToggleReminder: (item: ReminderItem) => Promise<void> | void;
};

export default function HomeView({
  todayEventCount,
  eventCount,
  total,
  openReminders,
  focusReminders,
  onVoice,
  onView,
  onOpenMlb,
  onToggleReminder
}: Props) {
  return (
    <section className="home-view">
      <div className="home-summary">
        <div><span>HOY</span><strong>{todayEventCount ? `${todayEventCount} evento${todayEventCount > 1 ? 's' : ''}` : 'Sin eventos hoy'}</strong></div>
        <button onClick={onVoice}><Mic size={18} /> Hablar con DJ NOA</button>
      </div>

      <button type="button" className="mlb-corner-badge" aria-label="Abrir sección MLB" onClick={onOpenMlb}>
        <img src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg" alt="MLB" />
        <span>MLB</span>
      </button>

      <div className="section-label-row"><span>ACCESOS RÁPIDOS</span></div>
      <div className="quick-grid">
        <button className="glass-card quick-card" onClick={() => onView('events')}><div className="quick-icon"><MapPin size={21} /></div><div><span>Eventos</span><strong>{eventCount} registrados</strong></div></button>
        <button className="glass-card quick-card" onClick={() => onView('calendar')}><div className="quick-icon"><CalendarDays size={21} /></div><div><span>Calendario</span><strong>{eventCount} eventos</strong></div></button>
        <button className="glass-card quick-card" onClick={() => onView('sheet')}><div className="quick-icon"><FileSpreadsheet size={21} /></div><div><span>Excel</span><strong>{money.format(total)}</strong></div></button>
        <button className="glass-card quick-card" onClick={() => onView('reminders')}><div className="quick-icon"><Bell size={21} /></div><div><span>Recordatorios</span><strong>{openReminders} pendientes</strong></div></button>
      </div>

      <div className="section-label-row"><span>LO SIGUIENTE</span><button onClick={() => onView('reminders')}>Ver todo</button></div>
      <div className="focus-list">
        {focusReminders.length ? focusReminders.map((item) => <button key={item.id} className="focus-row" onClick={() => void onToggleReminder(item)}><span className="focus-check" /><div><strong>{item.title}</strong><small>{item.dueAt ? format(parseISO(item.dueAt), "d MMM · HH:mm", { locale: es }) : 'Sin fecha'}</small></div></button>) : <div className="focus-empty">Nada pendiente por ahora.</div>}
      </div>
    </section>
  );
}
