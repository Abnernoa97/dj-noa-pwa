import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, ChevronLeft, ChevronRight, FileSpreadsheet, Plus } from 'lucide-react';
import { CALENDAR_STATUS_LABELS, selectCalendarDayEvents } from './havanaCalendarModel';
import type { EventItem, EventStatus, ReminderItem, SheetRow } from '../../shared/types';
import { formatMoneyAmount } from '../../domains/finance/moneyIntegrity';

type Props = {
  month: Date; setMonth: (date:Date)=>void;
  selectedDate: string; setSelectedDate: (date:string)=>void;
  events:EventItem[]; reminders:ReminderItem[]; rows:SheetRow[];
  colors: Record<EventStatus,string>; highlightedDates: string[];
  onOpenEvent: (event:EventItem)=>void; onCreateEvent: (date:string)=>void;
  onToggleReminder:(item:ReminderItem)=>Promise<void>|void;
  onOpenReminders:()=>void; onOpenSheetRow:(rowId?:string)=>void;
};

const MONTHS=Array.from({length:12},(_,i)=>format(new Date(2026,i,1),'MMMM',{locale:es}));
const dayKey=(date:Date)=>format(date,'yyyy-MM-dd');
const colorStyle=(status:EventStatus, colors:Record<EventStatus,string>)=>({'--hc-accent':colors[status]} as CSSProperties);

export default function HavanaMonthView({
  month,setMonth,selectedDate,setSelectedDate,events,reminders,rows,colors,highlightedDates,
  onOpenEvent,onCreateEvent,onToggleReminder,onOpenReminders,onOpenSheetRow
}: Props) {
  const years=useMemo(()=>{
    const active=events.map(event=>Number(event.date.slice(0,4))).filter(Number.isFinite);
    const min=Math.min(new Date().getFullYear()-15,month.getFullYear(),...active);
    const max=Math.max(new Date().getFullYear()+25,month.getFullYear(),...active);
    return Array.from({length:Math.min(150,max-min+1)},(_,i)=>min+i);
  },[events,month]);
  const first=startOfWeek(startOfMonth(month),{weekStartsOn:1});
  const last=endOfWeek(endOfMonth(month),{weekStartsOn:1});
  const days:Date[]=[];
  for(let date=first;date<=last;date=addDays(date,1))days.push(date);
  const today=dayKey(new Date());
  const monthKey=format(month,'yyyy-MM');
  const items=useMemo(()=>{
    const map=new Map<string,EventItem[]>();
    for(const event of events) {
      if(event.trashedAt)continue;
      const list=map.get(event.date)||[];
      list.push(event);
      map.set(event.date,list);
    }
    return map;
  },[events]);
  const eventIds=useMemo(()=>new Map(events.map(event=>[event.id,event])),[events]);
  const tasksByDay=useMemo(()=>{
    const map=new Map<string,ReminderItem[]>();
    for(const task of reminders) {
      const date=task.dueAt?.slice(0,10)||eventIds.get(task.eventId||'')?.date;
      if(!date)continue;
      const list=map.get(date)||[];
      list.push(task);
      map.set(date,list);
    }
    return map;
  },[reminders,eventIds]);
  const rowsByDay=useMemo(()=>{
    const map=new Map<string,SheetRow[]>();
    for(const row of rows) {
      const date=row.calendarDate||eventIds.get(row.eventId||'')?.date;
      if(!date)continue;
      const list=map.get(date)||[];
      list.push(row);
      map.set(date,list);
    }
    return map;
  },[rows,eventIds]);
  const dayEvents=selectCalendarDayEvents(events,selectedDate);
  const dayTasks=tasksByDay.get(selectedDate)||[];
  const dayRows=rowsByDay.get(selectedDate)||[];
  const selectDay=(date:Date)=>{
    setSelectedDate(dayKey(date));
    if(format(date,'yyyy-MM')!==monthKey)setMonth(startOfMonth(date));
  };
  const selectedAsDate=parseISO(selectedDate);
  return <div className="hc-month-layout">
    <section className="hc-panel hc-month-panel">
      <header className="hc-section-head">
        <div><span className="hc-overline">CALENDARIO</span><div className="hc-month-selectors">
          <select aria-label="Elegir mes" value={month.getMonth()} onChange={event=>setMonth(new Date(month.getFullYear(),Number(event.target.value),1))}>{MONTHS.map((name,i)=><option key={name} value={i}>{name.charAt(0).toUpperCase()+name.slice(1)}</option>)}</select>
          <select aria-label="Elegir año" value={month.getFullYear()} onChange={event=>setMonth(new Date(Number(event.target.value),month.getMonth(),1))}>{years.map(year=><option key={year} value={year}>{year}</option>)}</select>
        </div></div>
        <div className="hc-month-actions">
          <button type="button" onClick={()=>{const now=new Date();setMonth(startOfMonth(now));setSelectedDate(dayKey(now));}}>Hoy</button>
          <button type="button" onClick={()=>setMonth(addMonths(month,-1))} aria-label="Mes anterior"><ChevronLeft size={18}/></button>
          <button type="button" onClick={()=>setMonth(addMonths(month,1))} aria-label="Mes siguiente"><ChevronRight size={18}/></button>
        </div>
      </header>
      <div className="hc-weekdays">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(day=><span key={day}>{day}</span>)}</div>
      <div className="hc-month-grid" role="grid" aria-label="Calendario del mes">
        {days.map(date=>{
          const key=dayKey(date);
          const records=items.get(key)||[];
          const outside=date.getMonth()!==month.getMonth();
          const linked=(tasksByDay.get(key)||[]).length+(rowsByDay.get(key)||[]).length;
          return <button type="button" role="gridcell" key={key} aria-selected={selectedDate===key} aria-label={format(date,"d 'de' MMMM",{locale:es})+' · '+records.length+' eventos'}
            className={'hc-date'+(outside?' outside':'')+(key===today?' today':'')+(key===selectedDate?' selected':'')+(highlightedDates.includes(key)?' noah-updated':'')}
            onClick={()=>selectDay(date)}>
            <span className="hc-date-number">{date.getDate()}</span>
            <span className="hc-date-records">
              {records.slice(0,3).map(record=><span key={record.id} className="hc-date-pill" style={colorStyle(record.status,colors)} title={record.title}>{record.title}</span>)}
              {records.length>3&&<span className="hc-date-more">+{records.length-3}</span>}
              {linked>0&&<small className="hc-linked-count">{linked} vinculados</small>}
            </span>
          </button>;
        })}
      </div>
    </section>
    <section className="hc-panel hc-day-panel" aria-label="Agenda del día seleccionado">
      <header className="hc-section-head"><div><span className="hc-overline">DÍA SELECCIONADO</span><h2>{format(selectedAsDate,"EEEE d 'de' MMMM",{locale:es})}</h2></div><button type="button" className="hc-small-add" onClick={()=>onCreateEvent(selectedDate)}><Plus size={15}/> Añadir</button></header>
      {dayEvents.length===0&&dayTasks.length===0&&dayRows.length===0&&<p className="hc-empty">Sin registros para este día.</p>}
      <div className="hc-day-records">
        {dayEvents.map(event=><button type="button" className="hc-day-entry" key={event.id} onClick={()=>onOpenEvent(event)} style={colorStyle(event.status,colors)}>
          <span className="hc-entry-stripe"/><span><strong>{event.title}</strong><small>{event.venue||event.city||'Lugar pendiente'}</small></span><em>{CALENDAR_STATUS_LABELS[event.status]}</em><ChevronRight size={15}/>
        </button>)}
        {dayTasks.length>0&&<div className="hc-day-group"><Bell size={15}/> Recordatorios <button type="button" onClick={onOpenReminders}>Ver todo</button></div>}
        {dayTasks.map(task=><div className={'hc-task'+(task.done?' done':'')} key={task.id}><button type="button" aria-label={task.done?'Marcar pendiente':'Marcar realizado'} onClick={()=>void onToggleReminder(task)}>{task.done?'✓':''}</button><button type="button" onClick={onOpenReminders}>{task.title}</button></div>)}
        {dayRows.length>0&&<div className="hc-day-group"><FileSpreadsheet size={15}/> Excel <button type="button" onClick={()=>onOpenSheetRow()}>Abrir</button></div>}
        {dayRows.map(row=><button type="button" className="hc-day-entry" key={row.id} onClick={()=>onOpenSheetRow(row.id)}>
          <span><strong>{row.label}</strong><small>{row.category}</small></span><em>{formatMoneyAmount(row.amount,row.currency||'MXN')}</em><ChevronRight size={15}/>
        </button>)}
      </div>
    </section>
  </div>;
}
