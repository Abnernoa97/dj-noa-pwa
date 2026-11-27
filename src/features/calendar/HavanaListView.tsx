import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {Camera,ChevronRight,Trash2,X} from 'lucide-react';
import {db} from '../../services/storage/db';
import type {EventItem,EventStatus} from '../../shared/types';
import {
  CALENDAR_STATUS_LABELS,calendarCounters,groupCalendarYears,selectCalendarRecords
} from './havanaCalendarModel';
import type {HavanaEventFilter,HavanaQuoteFilter} from './havanaCalendarModel';

type Props={
  tab:'events'|'quotes';events:EventItem[];colors:Record<EventStatus,string>;
  onOpenEvent:(event:EventItem)=>void;
  onChangeStatus:(event:EventItem,status:EventStatus)=>Promise<void>;
  onTrashEvents:(events:EventItem[])=>Promise<void>;
};

function LocalCover({id}: {id:string}){
  const target=useRef<HTMLSpanElement>(null);
  const [visible,setVisible]=useState(false);
  const [src,setSrc]=useState<string|null>(null);
  useEffect(()=>{
    const node=target.current;
    if(!node)return;
    if(typeof IntersectionObserver==='undefined'){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}
    },{rootMargin:'200px'});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[id]);
  useEffect(()=>{
    if(!visible)return;
    let active=true,url:string|null=null;
    void db.eventPhotos.where('eventId').equals(id).first().then(photo=>{
      if(!active||!photo?.blob)return;
      url=URL.createObjectURL(photo.blob);
      setSrc(url);
    }).catch(()=>{});
    return ()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[id,visible]);
  return <span className="hc-cover" ref={target}>{src?<img src={src} alt="" loading="lazy"/>:<Camera size={18}/>}</span>;
}
export default function HavanaListView({tab,events,colors,onOpenEvent,onChangeStatus,onTrashEvents}:Props){
  const [eventFilter,setEventFilter]=useState<HavanaEventFilter>('upcoming');
  const [quoteFilter,setQuoteFilter]=useState<HavanaQuoteFilter>('future');
  const [search,setSearch]=useState('');
  const [selectionMode,setSelectionMode]=useState(false);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(()=>new Set());
  const today=new Date();
  const todayKey=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  const counts=calendarCounters(events,todayKey);
  const filtered=selectCalendarRecords(events,tab,tab==='events'?eventFilter:quoteFilter,todayKey)
    .filter(event=>!search.trim()||[event.title,event.venue,event.city,event.weddingPlanner].some(value=>
      (value||'').toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))));
  const years=groupCalendarYears(filtered);
  const selected=events.filter(event=>selectedIds.has(event.id));
  const changeFilter=(filter:HavanaEventFilter|HavanaQuoteFilter)=>{
    if(tab==='events')setEventFilter(filter as HavanaEventFilter);
    else setQuoteFilter(filter as HavanaQuoteFilter);
    setSelectedIds(new Set());setSelectionMode(false);
  };
  const toggle=(id:string)=>{
    setSelectedIds(current=>{
      const next=new Set(current);
      if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  };
  const exitSelection=()=>{setSelectedIds(new Set());setSelectionMode(false);};
  const moveSelected=async()=>{
    if(!selected.length)return;
    if(!window.confirm('¿Mover '+selected.length+' registro(s) a la papelera? Se conservan fotos, tareas y Excel.'))return;
    await onTrashEvents(selected);
    exitSelection();
  };
  return <section className="hc-panel hc-list-panel">
    <header className="hc-section-head hc-list-heading">
      <div><span className="hc-overline">{tab==='events'?'CONFIRMADOS Y REALIZADOS':'POR CONFIRMAR'}</span>
      <h2>{tab==='events'?'Mis eventos':'Mis cotizaciones'} <small>{tab==='events'?counts.events:counts.quotes}</small></h2></div>
      <button type="button" className="hc-outline" onClick={()=>selectionMode?exitSelection():setSelectionMode(true)}>
        {selectionMode?'Cancelar':'Seleccionar'}
      </button>
    </header>
    <div className="hc-list-filters">
      {tab==='events'?<>
        <button type="button" className={eventFilter==='upcoming'?'active':''} onClick={()=>changeFilter('upcoming')}>Por realizar <strong>{counts.upcoming}</strong></button>
        <button type="button" className={eventFilter==='completed'?'active':''} onClick={()=>changeFilter('completed')}>Realizados <strong>{counts.completed}</strong></button>
      </>:<>
        <button type="button" className={quoteFilter==='future'?'active':''} onClick={()=>changeFilter('future')}>Futuras <strong>{counts.futureQuotes}</strong></button>
        <button type="button" className={quoteFilter==='past'?'active':''} onClick={()=>changeFilter('past')}>Pasadas <strong>{counts.pastQuotes}</strong></button>
      </>}
    </div>
    <input type="search" className="hc-search" value={search} onChange={event=>setSearch(event.target.value)}
      placeholder="Buscar nombre, venue, ciudad o planner…" aria-label="Buscar registros"/>
    {selectionMode&&<div className="hc-selection-toolbar">
      <strong>{selectedIds.size} seleccionados</strong>
      <button type="button" onClick={()=>setSelectedIds(new Set(filtered.map(item=>item.id)))}>Seleccionar todos</button>
      <button type="button" disabled={!selectedIds.size} onClick={()=>void moveSelected()}><Trash2 size={15}/> Papelera</button>
      <button type="button" onClick={exitSelection} aria-label="Cancelar selección"><X size={17}/></button>
    </div>}
    {!years.length&&<p className="hc-empty">{tab==='events'?
      (eventFilter==='upcoming'?'Aún no hay eventos por realizar.':'Aún no hay eventos realizados.'):
      (quoteFilter==='future'?'No hay cotizaciones futuras.':'No hay cotizaciones pasadas.')}</p>}
    <div className="hc-year-list">{years.map((group,index)=><details key={tab+eventFilter+quoteFilter+group.year} className="hc-year" defaultOpen={index===0}>
      <summary><span>Año {group.year}</span><span>{group.events.length}<ChevronRight size={18}/></span></summary>
      <div className="hc-year-records">{group.events.map(event=><article key={event.id}
        className={'hc-record'+(selectedIds.has(event.id)?' is-selected':'')}
        style={{'--hc-accent':colors[event.status]} as CSSProperties}>
        <div className="hc-record-date"><strong>{Number(event.date.slice(8,10))}</strong><small>{event.date.slice(5,7)}/{event.date.slice(2,4)}</small></div>
        <button type="button" className="hc-record-main" onClick={()=>selectionMode?toggle(event.id):onOpenEvent(event)}>
          <strong>{event.title}</strong>
          <span>{event.venue||event.city||'Lugar pendiente'}</span>
          {event.weddingPlanner&&<small>Planner: {event.weddingPlanner}</small>}
        </button>
        <LocalCover id={event.id}/>
        {selectionMode?<button type="button" aria-pressed={selectedIds.has(event.id)} className="hc-checkbox" aria-label={'Seleccionar '+event.title} onClick={()=>toggle(event.id)}>{selectedIds.has(event.id)?'✓':''}</button>:
          <select className="hc-status-select" aria-label={'Estado de '+event.title} value={event.status} onChange={e=>void onChangeStatus(event,e.target.value as EventStatus)}>
            {(Object.keys(CALENDAR_STATUS_LABELS) as EventStatus[]).map(status=><option key={status} value={status}>{CALENDAR_STATUS_LABELS[status]}</option>)}
          </select>}
      </article>)}</div>
    </details>)}</div>
  </section>;
}
