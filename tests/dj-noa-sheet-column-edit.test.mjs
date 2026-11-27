import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSheetColumnEditor} from '../src/services/storage/sheetColumnMutations.ts';

function setup() {
 let columns=new Map([
  ['a',{id:'a',name:'Ingreso',key:'inc',behavior:'income',type:'currency',position:0}],
  ['b',{id:'b',name:'Gasto',key:'exp',behavior:'expense',type:'currency',position:1}]
 ]);
 let rows=new Map([
  ['usd',{id:'usd',currency:'USD',amount:75,financialType:'income',values:{inc:100,exp:25}}],
  ['manual',{id:'manual',currency:'USD',amount:999,financialType:'income',values:{}}],
  ['only-exp',{id:'only-exp',currency:'USD',amount:10,financialType:'expense',values:{exp:10}}],
  ['history',{id:'history',currency:'MXN',amount:500,financialType:'income',values:{inc:500}}]
 ]);
 let fail=false, rowWrites=0;
 const store={
  sheetColumns:{
   get:async id=>columns.get(id),
   update:async(id,patch)=>columns.set(id,{...columns.get(id),...patch}),
   orderBy:key=>{assert.equal(key,'position');return {toArray:async()=>[...columns.values()].sort((a,b)=>a.position-b.position)}}
  },
  sheetRows:{
   toArray:async()=>[...rows.values()],
   update:async(id,patch)=>{rowWrites++;if(fail)throw new Error('row_write_failed');rows.set(id,{...rows.get(id),...patch})}
  },
  transaction:async(mode,tables,fn)=>{
   assert.equal(mode,'rw');assert.equal(tables.length,2);
   const oldCols=new Map([...columns].map(([k,v])=>[k,{...v}]));
   const oldRows=new Map([...rows].map(([k,v])=>[k,{...v,values:{...v.values}}]));
   try{return await fn()}catch(e){columns=oldCols;rows=oldRows;throw e}
  }
 };
 return {store,cols:()=>columns,rows:()=>rows,writes:()=>rowWrites,fail:()=>{fail=true}};
}
test('renaming financial column has one owner, rejects normalized duplicates, and leaves values intact',async()=>{
 const s=setup(),edit=createSheetColumnEditor(s.store).updateSheetColumn;
 assert.deepEqual(await edit('missing',{name:'X'}),{column:null,changed:false});
 const duplicate=await edit('a',{name:'GÁSTO'});
 assert.equal(duplicate.duplicateName,'Gasto');
 assert.equal(s.cols().get('a').name,'Ingreso');
 assert.equal(s.writes(),0);
 const renamed=await edit('a',{name:'Ingresos contratados'});
 assert.equal(renamed.changed,true);
 assert.equal(s.cols().get('a').key,'inc');
 assert.equal(s.rows().get('manual').amount,999);
 assert.equal(s.writes(),0);
});
test('changing behavior recalculates only affected USD rows; leaves MXN/manual amounts intact',async()=>{
 const s=setup();
 const result=await createSheetColumnEditor(s.store).updateSheetColumn('a',{behavior:'expense'});
 assert.equal(result.changed,true);
 assert.equal(s.cols().get('a').behavior,'expense');
 assert.equal(s.rows().get('usd').amount,125);
 assert.equal(s.rows().get('usd').financialType,'expense');
 assert.equal(s.rows().get('manual').amount,999);
 assert.equal(s.rows().get('only-exp').amount,10);
 assert.equal(s.rows().get('history').amount,500);
 assert.equal(s.writes(),1);
});
test('removing a financial behavior recalculates remaining cells and preserves unrelated manual totals',async()=>{
 const s=setup();
 await createSheetColumnEditor(s.store).updateSheetColumn('a',{behavior:'neutral'});
 assert.equal(s.cols().get('a').type,'text');
 assert.equal(s.rows().get('usd').amount,25);
 assert.equal(s.rows().get('usd').financialType,'expense');
 assert.equal(s.rows().get('manual').amount,999);
});
test('failed recalculation rolls back behavior and existing row amounts in one transaction',async()=>{
 const s=setup();s.fail();
 await assert.rejects(createSheetColumnEditor(s.store).updateSheetColumn('a',{behavior:'expense'}),/row_write_failed/);
 assert.equal(s.cols().get('a').behavior,'income');
 assert.equal(s.rows().get('usd').amount,75);
});
test('Noah and Excel grid delegate edit and remove clone recomputation code',()=>{
 const ui=readFileSync(new URL('../src/features/excel/ExcelModulesEnhancer.tsx',import.meta.url),'utf8');
 const noah=readFileSync(new URL('../src/domains/noah/noahExcel.ts',import.meta.url),'utf8');
 for(const src of [ui,noah]){
  assert.match(src,/updateSheetColumn\(column\.id,/);
  assert.doesNotMatch(src,/await db\.sheetColumns\.update\(column\.id/);
 }
 assert.doesNotMatch(noah,/async function recalculateRows\(/);
});
