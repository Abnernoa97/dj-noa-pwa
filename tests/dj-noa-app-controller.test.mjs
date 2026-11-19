import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
const coordinator=readFileSync(new URL('../src/app/controllers/noahActionCoordinator.ts',import.meta.url),'utf8');

test('App delegates the complete Noah command implementation to one cross-feature coordinator',()=>{
 assert.match(app,/createNoahActionExecutor\(\{/);
 assert.match(app,/await import\('\.\/controllers\/noahActionCoordinator'\)/);
 assert.doesNotMatch(app,/action\.type === 'create_calendar_series'/);
 assert.doesNotMatch(app,/action\.type === 'delete_event'/);
 assert.match(coordinator,/export function createNoahActionExecutor\(/);
 assert.match(coordinator,/return executeNoahEventAction/);
 assert.match(coordinator,/action\.type === 'create_calendar_series'/);
 assert.match(coordinator,/action\.type === 'create_sheet_row'/);
 assert.match(coordinator,/action\.type === 'delete_event'/);
});
test('Noah coordinator keeps domain persistence rather than owning a second local database',()=>{
 for(const name of ['createEventWithRelations','createEventsWithRelations','updateEventWithRelations','deleteEventWithRelations','syncEventFinance']){
  assert.match(coordinator,new RegExp('\\b'+name+'\\('));
 }
 assert.match(coordinator,/normalizedEventIdentity\(/);
 assert.doesNotMatch(coordinator,/new Dexie\(/);
 assert.doesNotMatch(coordinator,/new Worker\(/);
});
