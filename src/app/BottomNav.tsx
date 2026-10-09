import { CalendarDays, CalendarCheck2, CheckCircle2, FileSpreadsheet, House } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppView } from '../types';

type Props = { view: AppView; onView: (view: AppView) => void };

export default function BottomNav({ view, onView }: Props) {
  return <nav className="bottom-nav ios-tab-bar" aria-label="Navegación principal">
    <NavButton active={view === 'home'} icon={<House size={23} />} label="Inicio" onClick={() => onView('home')} />
    <NavButton active={view === 'events'} icon={<CalendarCheck2 size={23} />} label="Eventos" onClick={() => onView('events')} />
    <NavButton active={view === 'calendar'} icon={<CalendarDays size={23} />} label="Calendario" onClick={() => onView('calendar')} />
    <NavButton active={view === 'sheet'} icon={<FileSpreadsheet size={23} />} label="Excel" onClick={() => onView('sheet')} />
    <NavButton active={view === 'reminders'} icon={<CheckCircle2 size={23} />} label="Tareas" onClick={() => onView('reminders')} />
  </nav>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" className={`nav-button ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} aria-label={label} onClick={onClick}>
    {icon}<span>{label}</span>
  </button>;
}
