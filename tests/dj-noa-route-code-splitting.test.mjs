import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
const pwa=readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8');
test('heavy route screens are lazy loaded, while the home route remains eager',()=>{
 for(const path of ['calendar/CalendarWorkspace','sports/MlbWorkspace','tasks/ReminderWorkspace','excel/SheetWorkspace']){
  assert.match(app,new RegExp('lazy\\(\\(\\) => import\\(\x27\\.\\.\\/features\\/'+path+'\x27\\)\\)'));
 }
 assert.match(app,/import HomeView from '\.\/HomeView'/);
 assert.match(app,/<Suspense fallback=/);
 assert.match(app,/role="status"/);
});
test('Noah action coordinator loads only when needed, keeping one async action contract',()=>{
 assert.match(app,/async \(action: NoahEventAction\): Promise<NoahEventActionResult>/);
 assert.match(app,/await import\('\.\/controllers\/noahActionCoordinator'\)/);
 assert.match(app,/createNoahActionExecutor\(\{/);
 assert.doesNotMatch(app,/^import \{ createNoahActionExecutor \}/m);
});
test('service worker precache includes JS chunks for offline route navigation',()=>{
 assert.match(pwa,/globPatterns:\s*\[[^\]]*\*\.\{js,css/);
});
