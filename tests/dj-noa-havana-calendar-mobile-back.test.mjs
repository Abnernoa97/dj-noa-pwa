import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Havana-style calendar overlays respect native Android back priority',()=>{
 const calendar=read('src/features/calendar/CalendarWorkspace.tsx');
 const list=read('src/features/calendar/HavanaListView.tsx');
 const summary=read('src/features/calendar/HavanaSummaryView.tsx');
 assert.match(calendar,/useNativeBack\(tab==='trash',/);
 assert.match(list,/useNativeBack\(selectionMode,exitSelection,80\)/);
 assert.match(summary,/useNativeBack\(colorsOpen,/);
});
