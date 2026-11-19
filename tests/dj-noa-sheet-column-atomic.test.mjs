import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSheetColumnDeletion } from '../src/services/storage/sheetColumnMutations.ts';

function setup() {
 const oldColumns=[
  {id:'income',key:'i',behavior:'income',position:0},
  {id:'expense',key:'e',behavior:'expense',position:1},
  {id:'notes',key:'n',behavior:'neutral',position:2}
 ];
 let columns=new Map(oldColumns.map(x=>[x.id,x]));
 let rows=new Map([
  ['usd',{id:'usd',currency:'USD',amount:75,financialType:'income',values:{i:100,e:25,n:'memo'}}],
  ['manual',{id:'manual',currency:'USD',amount:125,financialType:'income',values:{}}],
  ['mxn',{id:'mxn',currency:'MXN',amount:200,financialType:'income',values:{i:100,n:'note'}}]
 ]);
 let fail=false;
 let edits=0;
 const store={
  sheetColumns:{
   delete:async(id)=>{columns.delete(id);},
   orderBy:(key)=>{assert.equal(key,'position');return {toArray:async()=>[...columns.values()].sort((a,b)=>a.position-b.position)}}
  },
  sheetRows:{
   toArray:async()=>[...rows.values()],
   update:async(id,patch)=>{
    edits++;
    if(fail)throw new Error('failed_update');
    rows.set(id,{...rows.get(id),...patch});
   }
  },
  transaction:async(mode,tables,fn)=>{
   assert.equal(mode,'rw');assert.equal(tables.length,2);
   const savedCols=new Map(columns);
   const savedRows=new Map([...rows].map(([k,v])=>[k,{...v,values:{...v.values}}]));
   try{return await fn();}catch(e){columns=savedCols;rows=savedRows;throw e;}
  }
 };
 return {store,columns:()=>columns,rows:()=>rows,edits:()=>edits,fail:()=>{fail=true}};
}

test('column deletion is one atomic transaction and recalculates only affected USD money rows',async()=>{
 const s=setup();
 await createSheetColumnDeletion(s.store).deleteSheetColumnAndValues(s.columns().get('income'));
 assert.equal(s.columns().has('income'),false);
 assert.deepEqual(s.rows().get('usd').values,{e:25,n:'memo'});
 assert.equal(s.rows().get('usd').amount,25);
 assert.equal(s.rows().get('usd').financialType,'expense');
 assert.equal(s.rows().get('manual').amount,125);
 assert.deepEqual(s.rows().get('manual').values,{});
 assert.equal(s.rows().get('mxn').amount,200);
 assert.deepEqual(s.rows().get('mxn').values,{n:'note'});
 assert.equal(s.edits(),2);
});
test('neutral-column deletion never changes amounts or unrelated columns',async()=>{
 const s=setup();
 await createSheetColumnDeletion(s.store).deleteSheetColumnAndValues(s.columns().get('notes'));
 assert.equal(s.rows().get('usd').amount,75);
 assert.equal(s.rows().get('mxn').amount,200);
 assert.deepEqual(s.rows().get('usd').values,{i:100,e:25});
 assert.equal(s.edits(),2);
});
test('failed row write rolls back column removal and all row changes',async()=>{
 const s=setup();
 s.fail();
 await assert.rejects(createSheetColumnDeletion(s.store).deleteSheetColumnAndValues(s.columns().get('income')),/failed_update/);
 assert.equal(s.columns().has('income'),true);
 assert.deepEqual(s.rows().get('usd').values,{i:100,e:25,n:'memo'});
 assert.equal(s.rows().get('usd').amount,75);
});
test('both Excel interfaces and Noah use the same column-deletion owner',()=>{
 for(const path of ['src/features/excel/SheetWorkspace.tsx','src/features/excel/ExcelModulesEnhancer.tsx','src/domains/noah/noahExcel.ts']){
  const content=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(content,/deleteSheetColumnAndValues\(column\)/);
  assert.doesNotMatch(content,/await db\.sheetColumns\.delete\(column\.id\)/);
 }
});
