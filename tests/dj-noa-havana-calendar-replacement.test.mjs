import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('DJ NOA calendar has four Havana-style views and no Havana data or AI services',()=>{
 const root=read('src/features/calendar/CalendarWorkspace.tsx');
 for(const tab of ['calendar','events','quotes','summary'])assert.ok(root.includes("'"+tab+"'"));
 for(const file of [
  'src/features/calendar/CalendarWorkspace.tsx',
  'src/features/calendar/HavanaMonthView.tsx',
  'src/features/calendar/HavanaListView.tsx',
  'src/features/calendar/HavanaSummaryView.tsx',
  'src/features/calendar/havanaCalendarModel.ts'
 ]) {
  const source=read(file);
  for(const disallowed of ['HN_SYNC','havana-events-v1','havana-analytic-context','ANALYTIC_AI','havana-nice-events.pages.dev','/api/analytic','CALENDAR_DB'])
   assert.ok(!source.includes(disallowed),file+' may not include '+disallowed);
 }
 assert.match(root,/onAssistant=\{onAssistant\}/);
 assert.match(root,/trashedEvents/);
});
test('calendar mutates only DJ NOA records and Noah handles intelligence',()=>{
 const app=read('src/app/App.tsx');
 const editor=read('src/features/events/EventWorkspace.tsx');
 const trash=read('src/domains/events/eventTrash.ts');
 assert.match(app,/onAssistant=\{startNoah\}/);
 assert.match(app,/moveToTrash\(selected\.map/);
 assert.match(app,/restoreFromTrash\(event\.id\)/);
 assert.match(app,/updateEventWithRelations\(event\.id, \{ status \}\)/);
 assert.match(app,/acceptEventSnapshot/);
 assert.match(editor,/weddingPlanner: draft\.weddingPlanner/);
 assert.match(editor,/city: draft\.city/);
 assert.match(editor,/quote: draft\.quote/);
 assert.match(trash,/store\.transaction\('rw', store\.events/);
 assert.doesNotMatch(trash,/db\.sheetRows\.delete/);
});
test('calendar is fully replaced without old calendar-page CSS selectors',()=>{
 const root=read('src/features/calendar/CalendarWorkspace.tsx');
 assert.match(root,/className="hn-calendar"/);
 assert.doesNotMatch(root,/calendar-page|rich-week|calendar-grid-rich/);
 const css=read('src/features/calendar/styles/calendar.css');
 assert.match(css,/\.hn-calendar/);
 assert.doesNotMatch(css,/\.calendar-page/);
});
