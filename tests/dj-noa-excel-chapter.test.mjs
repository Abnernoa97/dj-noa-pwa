import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

test('Excel components and orientation live in one chapter without legacy copies',()=>{
 for(const name of ['SheetWorkspace.tsx','ExcelModulesEnhancer.tsx','useExcelLandscape.ts']){
  assert.ok(existsSync(new URL('src/features/excel/'+name,root)),name);
  assert.equal(existsSync(new URL('src/'+name,root)),false,'No duplicated root '+name);
 }
 const app=read('src/App.tsx'),main=read('src/main.tsx');
 assert.match(app,/from '\.\/features\/excel\/SheetWorkspace'/);
 assert.match(app,/from '\.\/features\/excel\/useExcelLandscape'/);
 assert.match(main,/from '\.\/features\/excel\/ExcelModulesEnhancer'/);
 assert.match(read('src/features/excel/SheetWorkspace.tsx'),/\.\.\/\.\.\/domains\/sheet\/sheetValues/);
});

test('Excel reorganization cannot change IndexedDB schema or skip Cloudflare build gate',()=>{
 const db=read('src/db.ts'),p=JSON.parse(read('package.json'));
 assert.match(db,/super\('dj-noa-local'\)/);
 assert.match(db,/this\.version\(6\)/);
 assert.match(p.scripts.build,/npm run audit:structure/);
 assert.match(p.scripts.build,/npm run test:ai/);
});
