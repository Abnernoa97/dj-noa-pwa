import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSheetRowDeletion } from '../src/services/storage/sheetMutations.ts';

function fakeStore() {
  let rows = new Map([['one',{id:'one'}],['two',{id:'two'}],['three',{id:'three'}]]);
  let photos = new Map([['p1',{id:'p1',rowId:'one'}],['p2',{id:'p2',rowId:'one'}],['p3',{id:'p3',rowId:'two'}],['p4',{id:'p4',rowId:'three'}]]);
  const calls = [];
  let failRowDeletion = false;
  const store = {
    sheetRows: {
      delete:async(id)=>{calls.push('single:'+id);if(failRowDeletion)throw new Error('row_delete_failed');rows.delete(id);},
      bulkDelete:async(ids)=>{calls.push('bulk:'+ids.join(','));if(failRowDeletion)throw new Error('row_delete_failed');for(const id of ids)rows.delete(id);}
    },
    sheetPhotos: {
      where:(key)=>{
        assert.equal(key,'rowId');
        return {equals:(rowId)=>({delete:async()=>{
          calls.push('photos:'+rowId);
          for(const [id,item] of photos)if(item.rowId===rowId)photos.delete(id);
        }})};
      }
    },
    transaction:async(mode,tables,fn)=>{
      assert.equal(mode,'rw');
      assert.equal(tables.length,2);
      const oldRows=new Map(rows),oldPhotos=new Map(photos);
      calls.push('begin');
      try{const result=await fn();calls.push('commit');return result;}
      catch(e){rows=oldRows;photos=oldPhotos;calls.push('rollback');throw e;}
    }
  };
  return {store,calls,rows:()=>rows,photos:()=>photos,fail:()=>{failRowDeletion=true;}};
}

test('single-row deletion uses original Table.delete and atomic photo cleanup',async()=>{
 const x=fakeStore();
 await createSheetRowDeletion(x.store).deleteSheetRowWithPhotos('one');
 assert.deepEqual(x.calls,['begin','photos:one','single:one','commit']);
 assert.deepEqual([...x.rows().keys()],['two','three']);
 assert.deepEqual([...x.photos().keys()],['p3','p4']);
});

test('selected rows use original bulkDelete in one transaction, preserving unrelated photos',async()=>{
 const x=fakeStore();
 await createSheetRowDeletion(x.store).deleteSheetRowsWithPhotos(['one','two']);
 assert.deepEqual(x.calls,['begin','photos:one','photos:two','bulk:one,two','commit']);
 assert.deepEqual([...x.rows().keys()],['three']);
 assert.deepEqual([...x.photos().keys()],['p4']);
 await createSheetRowDeletion(x.store).deleteSheetRowsWithPhotos([]);
 assert.equal(x.calls.filter(v=>v==='begin').length,1);
});

test('failed row deletion rolls back its photo deletions within transaction',async()=>{
 const x=fakeStore();
 x.fail();
 await assert.rejects(createSheetRowDeletion(x.store).deleteSheetRowWithPhotos('one'),/row_delete_failed/);
 assert.equal(x.calls.at(-1),'rollback');
 assert.deepEqual([...x.rows().keys()],['one','two','three']);
 assert.deepEqual([...x.photos().keys()],['p1','p2','p3','p4']);
});

test('all three Excel and Noah entrypoints delegate to one canonical storage owner',()=>{
 for(const path of ['src/domains/noah/noahExcel.ts','src/features/excel/ExcelModulesEnhancer.tsx','src/features/excel/SheetWorkspace.tsx']){
  const src=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(src,/services\/storage\/sheetMutations/);
  assert.doesNotMatch(src,/db\.sheetPhotos\.where\('rowId'\)\.equals\((?:row\.id|id)\)\.delete\(\)/);
 }
});
