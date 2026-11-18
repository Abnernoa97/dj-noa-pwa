import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { db } from '../src/services/storage/db.ts';
import { deleteSheetRowWithPhotos, deleteSheetRowsWithPhotos } from '../src/services/storage/sheetMutations.ts';

const row=(id)=>({id,label:'Row '+id,category:'General',amount:20,currency:'USD',status:'pending',values:{},createdAt:'2026-11-18T12:00:00.000Z'});
const photo=(id,rowId)=>({id,rowId,name:id+'.jpg',type:'image/jpeg',blob:new Blob(['photo-'+id],{type:'image/jpeg'}),createdAt:'2026-11-18T12:00:00.000Z'});
async function reset(){await db.delete();await db.open();}
async function finish(){await db.delete();}
test('single deletion removes its attachments atomically but keeps unrelated rows and photos',async()=>{
 await reset();
 try{
  await db.sheetRows.bulkAdd([row('one'),row('two')]);
  await db.sheetPhotos.bulkAdd([photo('p1','one'),photo('p2','one'),photo('p3','two')]);
  await deleteSheetRowWithPhotos('one');
  assert.equal(await db.sheetRows.get('one'),undefined);
  assert.equal(await db.sheetPhotos.where('rowId').equals('one').count(),0);
  assert.equal(await db.sheetRows.count(),1);
  assert.equal(await db.sheetPhotos.count(),1);
  assert.equal((await db.sheetPhotos.get('p3')).name,'p3.jpg');
 } finally {await finish();}
});
test('selection deletion uses one transaction and leaves other photos intact',async()=>{
 await reset();
 try{
  await db.sheetRows.bulkAdd([row('a'),row('b'),row('c')]);
  await db.sheetPhotos.bulkAdd([photo('p-a','a'),photo('p-b','b'),photo('p-c','c')]);
  await deleteSheetRowsWithPhotos(['a','b']);
  assert.deepEqual((await db.sheetRows.toArray()).map(x=>x.id),['c']);
  assert.deepEqual((await db.sheetPhotos.toArray()).map(x=>x.id),['p-c']);
  await deleteSheetRowsWithPhotos([]);
  assert.equal(await db.sheetRows.count(),1);
 } finally {await finish();}
});
test('caller transaction abort restores both row and photo (no partial deletion)',async()=>{
 await reset();
 try {
  await db.sheetRows.add(row('rollback'));
  await db.sheetPhotos.add(photo('kept','rollback'));
  await assert.rejects(db.transaction('rw',[db.sheetRows,db.sheetPhotos],async()=>{
    await deleteSheetRowWithPhotos('rollback');
    throw new Error('abort_outer_transaction');
  }),/abort_outer_transaction/);
  assert.equal(await db.sheetRows.count(),1);
  assert.equal(await db.sheetPhotos.count(),1);
 } finally {await finish();}
});
test('all three Excel and Noah entrypoints use the one storage owner',()=>{
 for(const path of ['src/domains/noah/noahExcel.ts','src/features/excel/ExcelModulesEnhancer.tsx','src/features/excel/SheetWorkspace.tsx']){
  const src=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(src,/services\/storage\/sheetMutations/);
  assert.doesNotMatch(src,/db\.sheetPhotos\.where\('rowId'\)\.equals\((?:row\.id|id)\)\.delete\(\)/);
 }
});
