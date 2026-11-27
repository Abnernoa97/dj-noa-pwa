import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarCounters,selectCalendarRecords,groupCalendarYears,selectCalendarDayEvents} from '../src/features/calendar/havanaCalendarModel.ts';

const records=[
 {id:'future',title:'Concierto A',date:'2027-05-08',status:'confirmed'},
 {id:'done',title:'Concierto B',date:'2025-12-10',status:'done'},
 {id:'past-confirmed',title:'Concierto C',date:'2025-11-10',status:'confirmed'},
 {id:'quote',title:'Cotización nueva',date:'2027-06-01',status:'tentative'},
 {id:'old-quote',title:'Cotización vieja',date:'2024-01-01',status:'tentative'},
 {id:'trash',title:'Evento archivado',date:'2027-01-01',status:'confirmed',trashedAt:'2026-11-20T12:00:00Z'}
];
test('Havana lifecycle maps to DJ statuses without importing source records or Havana AI',()=>{
 assert.deepEqual(calendarCounters(records,'2026-11-27'),{events:3,all:5,upcoming:1,completed:2,quotes:2,futureQuotes:1,pastQuotes:1});
 assert.deepEqual(selectCalendarRecords(records,'events','upcoming','2026-11-27').map(x=>x.id),['future']);
 assert.deepEqual(selectCalendarRecords(records,'events','completed','2026-11-27').map(x=>x.id),['done','past-confirmed']);
 assert.deepEqual(selectCalendarRecords(records,'quotes','future','2026-11-27').map(x=>x.id),['quote']);
 assert.deepEqual(selectCalendarRecords(records,'quotes','past','2026-11-27').map(x=>x.id),['old-quote']);
});
test('year accordions derive from actual dates, including new years',()=>{
 const groups=groupCalendarYears([records[3],records[0],records[1]]);
 assert.deepEqual(groups.map(x=>[x.year,x.events.length]),[['2027',2],['2025',1]]);
});
test('month day items ignore trash and preserve time order',()=>{
 const items=selectCalendarDayEvents([{id:'late',title:'Late',date:'2027-05-08',status:'confirmed',showTime:'21:00'},{id:'early',title:'Early',date:'2027-05-08',status:'confirmed',time:'15:00'},records[5]],'2027-05-08');
 assert.deepEqual(items.map(x=>x.id),['early','late']);
});
