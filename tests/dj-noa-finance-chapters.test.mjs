import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
test('money summaries have one canonical finance chapter and no legacy root copies',()=>{
for(const name of ['financialOverview.ts','moneyIntegrity.ts']){
 assert.equal(existsSync(new URL('src/'+name,root)),false,'duplicate finance root '+name);
 assert.ok(existsSync(new URL('src/domains/finance/'+name,root)),'missing canonical '+name);
}
 assert.equal(existsSync(new URL('src/domains/finance/finance.ts',root)),false,'obsolete category-based money summary must not return');
});
test('USD reconciliation remains shared by Excel, Calendar, Events and App',()=>{
for(const p of ['src/app/App.tsx','src/features/excel/SheetWorkspace.tsx','src/features/calendar/HavanaSummaryView.tsx','src/features/events/EventWorkspace.tsx']){
 const s=read(p);
 assert.match(s,/domains\/finance\/financialOverview/,p);
 assert.match(s,/domains\/finance\/moneyIntegrity/,p);
}
const calendar=read('src/features/calendar/CalendarWorkspace.tsx');
assert.match(calendar,/HavanaSummaryView/);
const month=read('src/features/calendar/HavanaMonthView.tsx');
assert.match(month,/domains\/finance\/moneyIntegrity/);
const db=read('src/services/storage/db.ts');
assert.match(db,/super\('dj-noa-local'\)/);
});
