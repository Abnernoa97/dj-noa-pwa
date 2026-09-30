import { Bell, CalendarDays, FileSpreadsheet, Home, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppView } from '../types';

type Props = {
  view: AppView;
  onView: (view: AppView) => void;
};

export default function BottomNav({ view, onView }: Props) {
  return (
    <nav className="bottom-nav">
      <NavButton active={view === 'home'} icon={<Home size={20} />} label="Inicio" onClick={() => onView('home')} />
      <NavButton active={view === 'events'} icon={<MapPin size={20} />} label="Eventos" onClick={() => onView('events')} />
      <NavButton active={view === 'calendar'} icon={<CalendarDays size={20} />} label="Calendario" onClick={() => onView('calendar')} />
      <NavButton active={view === 'sheet'} icon={<FileSpreadsheet size={20} />} label="Excel" onClick={() => onView('sheet')} />
      <NavButton active={view === 'reminders'} icon={<Bell size={20} />} label="Tareas" onClick={() => onView('reminders')} />
    </nav>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}
