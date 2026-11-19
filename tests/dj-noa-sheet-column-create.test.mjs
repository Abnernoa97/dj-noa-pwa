import test from 'node:test';
import assert from 'node:assert/strict';
import {createGridColumnWriter} from '../src/services/storage/sheetColumnMutations.ts';

function mockColumns() {
 const columns=[];
 const ids=['aaaaaa-1','bbbbbb-2','cccccc-3','dddddd-4'];
 const store={
  sheetColumns:{
   orderBy:(key)=>{assert.equal(key,'position');return {toArray:async()=>[...columns]};},
   add:async(col)=>{columns.push(col);}
  },
  transaction:async(mode,table,fn)=>{
   assert.equal(mode,'rw');assert.equal(table,store.sheetColumns);
   return fn();
  }
 };
 return {store,columns,nextId:()=>ids.shift()||'eeeeee'};
}
test('Grid and Noah share creation, column key and normalized duplicate detection',async()=>{
 const f=mockColumns();
 const create=createGridColumnWriter(f.store,f.nextId).createGridSheetColumn;
 const first=await create('  Ingreso  ','income');
 assert.equal(first.created,true);
 assert.equal(first.column.name,'Ingreso');
 assert.equal(first.column.key,'grid_ingreso_bbbbbb');
 assert.equal(first.column.type,'currency');
 assert.equal(first.column.position,0);
 const duplicate=await create('INGRÉSO','expense');
 assert.equal(duplicate.created,false);
 assert.equal(duplicate.column.id,first.column.id);
 assert.equal(f.columns.length,1);
 const second=await create('Gasto','expense');
 assert.equal(second.created,true);
 assert.equal(second.column.position,1);
 assert.equal(second.column.type,'currency');
});
test('neutral grid columns use text and never create empty labels',async()=>{
 const f=mockColumns();
 const create=createGridColumnWriter(f.store,f.nextId).createGridSheetColumn;
 await assert.rejects(create('  ','neutral'),/empty_column_name/);
 const result=await create('Comentario','neutral');
 assert.equal(result.column.type,'text');
 assert.equal(result.column.behavior,'neutral');
});
