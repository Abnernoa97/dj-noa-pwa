import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
test('money summaries have one canonical finance chapter and no legacy root copies',()=>{
for(const name of ['finance.ts','financialOverview.ts','moneyIntegrity.ts']){
 assert.equal(existsSync(new URL('src/'+name,root)),false,'duplicate finance root '+name);
 assert.ok(existsSync(new URL('src/domains/finance/'+name,root)),'missing canonical '+name);
}
});
test('USD reconciliation remains shared by Excel, Calendar, Events and App',()=>{
for(const p of ['src/app/App.tsx','src/features/excel/SheetWorkspace.tsx','src/features/calendar/CalendarWorkspace.tsx','src/features/events/EventWorkspace.tsx']){
 const s=read(p);
 assert.match(s,/domains\/finance\/financialOverview/,p);
 assert.match(s,/domains\/finance\/moneyIntegrity/,p);
}
const db=read('src/db.ts');
assert.match(db,/super\('dj-noa-local'\)/);
});
