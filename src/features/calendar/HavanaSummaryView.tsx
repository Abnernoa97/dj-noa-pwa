import {useState} from 'react';
import {useNativeBack} from '../../app/navigationBack';
import {BarChart3,Mic,Settings2,Trash2,X} from 'lucide-react';
import {formatMoneyAmount} from '../../domains/finance/moneyIntegrity';
import {portfolioUsdSettlement} from '../../domains/finance/financialOverview';
import type {EventItem,EventStatus,SheetRow} from '../../shared/types';
import {CALENDAR_STATUS_LABELS,DEFAULT_CALENDAR_COLORS,calendarCounters} from './havanaCalendarModel';

type Props={
  events:EventItem[];rows:SheetRow[];trashCount:number;
  colors:Record<EventStatus,string>;setColors:(next:Record<EventStatus,string>)=>void;
  onAssistant:()=>void;onOpenTrash:()=>void;
};

function rankBy(events:EventItem[],field:'venue'|'city'|'weddingPlanner') {
  const groups=new Map<string,{name:string;count:number}>();
  for(const event of events) {
    const name=event[field]?.trim();
    if(!name)continue;
    const key=name.toLocaleLowerCase('es');
    const found=groups.get(key);
    if(found)found.count++;
    else groups.set(key,{name,count:1});
  }
  return [...groups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es')).slice(0,5);
}

export default function HavanaSummaryView({events,rows,trashCount,colors,setColors,onAssistant,onOpenTrash}:Props) {
  const [colorsOpen,setColorsOpen]=useState(false);
  useNativeBack(colorsOpen,()=>setColorsOpen(false),85);
  const today=new Date();
  const date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const counts=calendarCounters(events,date);
  const finance=portfolioUsdSettlement(rows);
  const money=(n:number|null)=>n===null?'Por revisar':formatMoneyAmount(n,'USD')+' USD';
  const displayEvents=events.filter(e=>!e.trashedAt);
  const years=[...new Set(displayEvents.map(e=>e.date.slice(0,4)))].sort((a,b)=>b.localeCompare(a));
  return <div className="hc-summary">
    <section className="hc-panel hc-summary-main">
      <div className="hc-summary-heading">
        <div><span className="hc-overline">TU ACTIVIDAD</span><h2>Resumen de eventos</h2>
          <p>Estadísticas calculadas con los registros propios de DJ NOA.</p></div>
        <button type="button" className="hc-noah" onClick={onAssistant}><Mic size={17}/> Preguntar a Noah</button>
      </div>
      <div className="hc-kpis">
        {[['Realizados',counts.completed],['Por realizar',counts.upcoming],['Cotizaciones',counts.quotes],['Registros',counts.all]].map(([label,count])=>
          <div className="hc-kpi" key={label}><strong>{new Intl.NumberFormat('es-MX').format(count as number)}</strong><span>{label}</span></div>)}
      </div>
      <div className="hc-money-stats">
        <div><span>CONTRATADO USD</span><strong>{money(finance.contracted)}</strong></div>
        <div><span>RECIBIDO USD</span><strong>{money(finance.received)}</strong></div>
        <div><span>PENDIENTE USD</span><strong>{money(finance.pending)}</strong></div>
      </div>
      <p className="hc-small-print">Los importes provienen de Excel de DJ NOA. Una cotización no es un cobro. No se mezclan monedas ni se convierten montos históricos.</p>
    </section>
    <div className="hc-ranking-grid">
      {([['Venues','venue'],['Wedding planners','weddingPlanner'],['Ciudades','city']] as const).map(([title,field])=>{
        const rankings=rankBy(displayEvents,field);
        return <section className="hc-panel hc-ranking" key={field}><h3>{title}</h3>
          {!rankings.length?<p className="hc-empty">Aún no hay datos.</p>:
          <ol>{rankings.map((entry,i)=><li key={entry.name}><span>{i+1}. {entry.name}</span><strong>{entry.count}</strong></li>)}</ol>}
        </section>;
      })}
    </div>
    <section className="hc-panel hc-years-overview">
      <header className="hc-section-head"><div><span className="hc-overline">HISTORIAL</span><h2>Actividad por año</h2></div><BarChart3 size={18}/></header>
      {!years.length&&<p className="hc-empty">Todavía no hay eventos registrados.</p>}
      {years.map(year=>{
        const annual=displayEvents.filter(e=>e.date.startsWith(year));
        const completed=annual.filter(e=>e.status==='done'||(e.status==='confirmed'&&e.date<date)).length;
        const quotes=annual.filter(e=>e.status==='tentative').length;
        return <div className="hc-year-overview-row" key={year}><strong>{year}</strong><span>{annual.length} registros</span><span>{completed} realizados</span><span>{quotes} cotizaciones</span></div>;
      })}
    </section>
    <section className="hc-panel hc-settings-links">
      <button type="button" onClick={()=>setColorsOpen(true)}><Settings2 size={18}/> Personalizar colores de estados</button>
      <button type="button" onClick={onOpenTrash}><Trash2 size={18}/> Papelera {trashCount>0?'('+trashCount+')':''}</button>
    </section>
    {colorsOpen&&<div className="hc-color-overlay" onClick={()=>setColorsOpen(false)}>
      <section className="hc-color-panel" role="dialog" aria-modal="true" aria-label="Personalizar colores" onClick={e=>e.stopPropagation()}>
        <header><h3>Colores de estados</h3><button type="button" onClick={()=>setColorsOpen(false)} aria-label="Cerrar"><X size={20}/></button></header>
        {(Object.keys(CALENDAR_STATUS_LABELS) as EventStatus[]).map(status=><label key={status}><span>{CALENDAR_STATUS_LABELS[status]}</span><input type="color" value={colors[status]} onChange={e=>setColors({...colors,[status]:e.target.value})}/></label>)}
        <button type="button" className="hc-reset-color" onClick={()=>setColors({...DEFAULT_CALENDAR_COLORS})}>Restaurar colores originales</button>
      </section>
    </div>}
  </div>;
}
