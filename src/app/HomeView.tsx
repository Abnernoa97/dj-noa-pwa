import { useState } from 'react';
import { CalendarDays, CalendarCheck2, ChevronRight, CheckCircle2, FileSpreadsheet, ImagePlus, Mic, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import NbaWorkspace from '../NbaWorkspace';
import { useNativeBack } from '../navigationBack';
import type { AppView, EventItem, ReminderItem } from '../types';

type Props = {
  todayEventCount: number;
  upcoming: EventItem | undefined;
  eventCount: number;
  total: string;
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
  upcoming,
  eventCount,
  total,
  openReminders,
  focusReminders,
  onVoice,
  onView,
  onOpenMlb,
  onOpenEvent,
  onCreateEvent,
  onToggleReminder
}: Props) {
  const [nbaOpen, setNbaOpen] = useState(false);
  useNativeBack(nbaOpen, () => setNbaOpen(false), 50);
  if (nbaOpen) return <NbaWorkspace onBack={() => setNbaOpen(false)} />;

  const openImageIntake = () => document.querySelector<HTMLButtonElement>('.noah-image-trigger')?.click();

  return (
    <section className="home-view ios-home" aria-label="Inicio DJ NOA">
      <div className="ios-home-hero">
        <div className="sports-corner-stack" aria-label="Deportes">
          <button type="button" className="sports-corner-badge mlb-corner-badge" aria-label="Abrir MLB" onClick={onOpenMlb}>
            <img src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg" alt="" /><span>MLB</span><ChevronRight size={15} />
          </button>
          <button type="button" className="sports-corner-badge nba-corner-badge" aria-label="Abrir NBA" onClick={() => setNbaOpen(true)}>
            <img src="https://cdn.nba.com/logos/leagues/logo-nba.svg" alt="" /><span>NBA</span><ChevronRight size={15} />
          </button>
        </div>
      </div>

      <button className="ios-home-today" onClick={() => onView('calendar')}>
        <span className="ios-home-circle"><CalendarDays size={23} /></span>
        <span className="ios-home-card-copy">
          <span className="ios-home-eyebrow">HOY</span>
          <strong>{todayEventCount ? `${todayEventCount} evento${todayEventCount === 1 ? '' : 's'} hoy` : 'Sin eventos hoy'}</strong>
          <small>{todayEventCount ? 'Consulta los detalles de tu agenda.' : 'Tu agenda está libre por ahora.'}</small>
        </span>
        <ChevronRight size={19} className="ios-home-chevron" />
      </button>

      <section className="ios-home-upcoming">
        <div className="ios-home-section-heading"><CalendarCheck2 size={19} /><span>PRÓXIMO EVENTO</span></div>
        {upcoming ? <button className="ios-home-upcoming-link" onClick={() => onOpenEvent(upcoming)}>
          <strong>{upcoming.title}</strong>
          <small>{format(parseISO(upcoming.date), "d 'de' MMMM", { locale: es })}{upcoming.time ? ` · ${upcoming.time}` : ''}{upcoming.venue ? ` · ${upcoming.venue}` : ''}</small>
          <ChevronRight size={18} />
        </button> : <button className="ios-home-upcoming-link is-empty" onClick={onCreateEvent}>
          <strong>No hay eventos próximos.</strong>
          <small>Cuando tengas uno, aparecerá aquí.</small>
          <Plus size={19} />
        </button>}
      </section>

      <div className="ios-home-two-cards">
        <button onClick={() => onView('reminders')} className="ios-home-metric">
          <span className="ios-home-metric-heading"><CheckCircle2 size={18} /> PENDIENTES</span>
          <strong>{openReminders}</strong>
          <small>{openReminders === 1 ? 'Tarea por hacer' : 'Tareas por hacer'}</small>
        </button>
        <button onClick={() => onView('sheet')} className="ios-home-metric">
          <span className="ios-home-metric-heading"><FileSpreadsheet size={18} /> RESUMEN</span>
          <div className="ios-home-metric-list"><span>{eventCount} eventos</span><span>{openReminders} tareas</span><span>{total} balance</span></div>
        </button>
      </div>

      {focusReminders.length > 0 && <section className="ios-home-next-tasks" aria-label="Siguientes tareas">
        <h3>LO SIGUIENTE</h3>
        {focusReminders.slice(0, 2).map(item => <button key={item.id} onClick={() => void onToggleReminder(item)}>
          <CheckCircle2 size={20} /><span>{item.title}</span>
          <small>{item.dueAt ? format(parseISO(item.dueAt), 'd MMM', { locale: es }) : ''}</small>
        </button>)}
      </section>}

      <div className="ios-home-tools">
        <h3>ACCIONES DE NOAH</h3>
        <div>
          <button type="button" onClick={openImageIntake}><ImagePlus size={20} /><span>Subir imagen</span><ChevronRight size={16} /></button>
          <button type="button" onClick={onVoice}><Mic size={20} /><span>Hablar con Noah</span><ChevronRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}
