import {useEffect,useState} from 'react';
import {BarChart3,CalendarDays,Check,ChevronLeft,FileSpreadsheet,Plus,RotateCcw,Trash2} from 'lucide-react';
import {format} from 'date-fns';
import {useNativeBack} from '../../app/navigationBack';
import type {EventItem,EventStatus,ReminderItem,SheetRow} from '../../shared/types';
import {DEFAULT_CALENDAR_COLORS,CALENDAR_STATUS_LABELS,calendarCounters} from './havanaCalendarModel';
import type {HavanaCalendarTab} from './havanaCalendarModel';
import HavanaMonthView from './HavanaMonthView';
import HavanaListView from './HavanaListView';
import HavanaSummaryView from './HavanaSummaryView';

type Tab = HavanaCalendarTab | 'trash';
type Props = {
  month:Date;setMonth:(date:Date)=>void;
  events:EventItem[];trashedEvents?:EventItem[];
  reminders:ReminderItem[];sheetRows:SheetRow[];noahHighlightDates?:string[];
  onOpenEvent:(event:EventItem)=>void;
  onCreateEvent:(date:string,status?:EventStatus)=>void;
  onChangeStatus:(event:EventItem,status:EventStatus)=>Promise<void>;
  onTrashEvents:(events:EventItem[])=>Promise<void>;
  onRestoreEvent:(event:EventItem)=>Promise<void>;
  onPermanentlyDelete:(event:EventItem)=>Promise<void>;
  onToggleReminder:(item:ReminderItem)=>Promise<void>|void;
  onOpenReminders:()=>void;
  onOpenSheetRow:(rowId?:string)=>void;
  onAssistant:()=>void;
};
const COLOR_KEY='dj-noa-calendar-status-colors-v1';

function loadColors():Record<EventStatus,string>{
  const result={...DEFAULT_CALENDAR_COLORS};
  if(typeof localStorage==='undefined')return result;
  try {
    const value=JSON.parse(localStorage.getItem(COLOR_KEY)||'null') as Partial<Record<EventStatus,string>>|null;
    for(const status of Object.keys(result) as EventStatus[]){
      const color=value?.[status];
      if(typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color))result[status]=color;
    }
  } catch { /* Preference is optional; never block the app. */ }
  return result;
}

export default function CalendarWorkspace({
  month,setMonth,events,trashedEvents=[],reminders,sheetRows,noahHighlightDates=[],
  onOpenEvent,onCreateEvent,onChangeStatus,onTrashEvents,onRestoreEvent,onPermanentlyDelete,
  onToggleReminder,onOpenReminders,onOpenSheetRow,onAssistant
}:Props){
  const [tab,setTab]=useState<Tab>('calendar');
  const [selectedDate,setSelectedDate]=useState(()=>format(new Date(),'yyyy-MM-dd'));
  const [colors,setColors]=useState<Record<EventStatus,string>>(loadColors);
  useNativeBack(tab==='trash',()=>setTab('summary'),65);
  useEffect(()=>{
    try {localStorage.setItem(COLOR_KEY,JSON.stringify(colors));}
    catch { /* Local-only preference. */ }
  },[colors]);
  const today=format(new Date(),'yyyy-MM-dd');
  const counters=calendarCounters(events,today);
  const create=(date:string)=>onCreateEvent(date,tab==='quotes'?'tentative':'confirmed');
  const changeTab=(next:Tab)=>setTab(next);
  return <section className="hn-calendar" aria-label="Calendario completo DJ NOA">
    <header className="hc-header">
      <div className="hc-eyebrow"><CalendarDays size={14}/> DJ NOA · AGENDA PRIVADA</div>
      <div className="hc-heading">
        <div><h1>{tab==='calendar'?'Tu calendario':tab==='events'?'Eventos':tab==='quotes'?'Cotizaciones':tab==='summary'?'Resumen':'Papelera'}</h1>
          <p>Todo organizado en un solo lugar</p></div>
        <button type="button" className="hc-primary" onClick={()=>create(selectedDate)}><Plus size={17}/> {tab==='quotes'?'Cotización':'Nuevo'}</button>
      </div>
    </header>
    <nav className="hc-tabs" aria-label="Secciones de calendario">
      {([
        ['calendar','Calendario',CalendarDays],['events','Eventos',Check],
        ['quotes','Cotizaciones',FileSpreadsheet],['summary','Resumen',BarChart3]
      ] as const).map(([id,label,Icon])=><button type="button" key={id} onClick={()=>changeTab(id)}
        className={tab===id?'active':''} aria-current={tab===id?'page':undefined}>
          <Icon size={17}/><span>{label}</span>
          {id==='events'&&<small>{counters.events}</small>}
          {id==='quotes'&&<small>{counters.quotes}</small>}
        </button>)}
    </nav>
    {tab==='calendar'&&<HavanaMonthView
      month={month} setMonth={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
      events={events} reminders={reminders} rows={sheetRows} colors={colors}
      highlightedDates={noahHighlightDates} onOpenEvent={onOpenEvent} onCreateEvent={date=>onCreateEvent(date,'confirmed')}
      onToggleReminder={onToggleReminder} onOpenReminders={onOpenReminders} onOpenSheetRow={onOpenSheetRow}/>}
    {(tab==='events'||tab==='quotes')&&<HavanaListView key={tab} tab={tab} events={events} colors={colors}
      onOpenEvent={onOpenEvent} onChangeStatus={onChangeStatus} onTrashEvents={onTrashEvents}/>}
    {tab==='summary'&&<HavanaSummaryView events={events} rows={sheetRows} trashCount={trashedEvents.length}
      colors={colors} setColors={setColors} onAssistant={onAssistant} onOpenTrash={()=>changeTab('trash')}/>}
    {tab==='trash'&&<section className="hc-panel hc-trash-panel">
      <header className="hc-section-head"><div><span className="hc-overline">REGISTROS RECUPERABLES</span><h2>Papelera <small>{trashedEvents.length}</small></h2></div>
        <button type="button" className="hc-outline" onClick={()=>changeTab('summary')}><ChevronLeft size={16}/> Resumen</button>
      </header>
      <p className="hc-muted">Restaurar conserva el mismo ID, fotos, recordatorios y Excel vinculados.</p>
      {!trashedEvents.length&&<p className="hc-empty">La papelera está vacía.</p>}
      {trashedEvents.map(event=><article className="hc-trash-row" key={event.id}>
        <div><strong>{event.title}</strong><small>{event.date} · {CALENDAR_STATUS_LABELS[event.status]}</small></div>
        <button type="button" onClick={()=>void onRestoreEvent(event)}><RotateCcw size={15}/> Restaurar</button>
        <button type="button" className="hc-delete-forever" onClick={()=>{
          if(window.confirm('¿Eliminar definitivamente el evento, sus fotos y datos vinculados? Esta acción no se puede deshacer.'))void onPermanentlyDelete(event);
        }}><Trash2 size={15}/> Eliminar</button>
      </article>)}
    </section>}
  </section>;
}
