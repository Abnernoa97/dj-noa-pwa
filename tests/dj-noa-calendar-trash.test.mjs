import test from 'node:test';
import assert from 'node:assert/strict';
import {createCalendarTrash} from '../src/domains/events/eventTrash.ts';
function mock(){
 let records=new Map([['a',{id:'a',title:'A'}],['b',{id:'b',title:'B'}]]);
 let fail=false;
 const store={
  events:{
   get:async id=>records.get(id),
   update:async(id,patch)=>{if(fail)throw new Error('fail_update');records.set(id,{...records.get(id),...patch})}
  },
  transaction:async(mode,table,fn)=>{
   assert.equal(mode,'rw');assert.equal(table,store.events);
   const snapshot=new Map([...records].map(([k,v])=>[k,{...v}]));
   try{return await fn()}catch(e){records=snapshot;throw e;}
  }
 };
 return {store,records:()=>records,fail:()=>{fail=true}};
}
test('moving events to trash is reversible and never deletes linked data',async()=>{
 const m=mock();const owner=createCalendarTrash(m.store);
 assert.equal(await owner.moveToTrash(['a','a','missing']),1);
 assert.equal(typeof m.records().get('a').trashedAt,'string');
 assert.equal(await owner.moveToTrash(['a']),0);
 assert.equal(await owner.restoreFromTrash('a'),true);
 assert.equal(m.records().get('a').trashedAt,undefined);
 assert.equal(await owner.restoreFromTrash('a'),false);
 assert.equal(m.records().get('b').title,'B');
});
test('trash batch rolls back if update fails and cannot silently erase events',async()=>{
 const m=mock();m.fail();const owner=createCalendarTrash(m.store);
 await assert.rejects(owner.moveToTrash(['a']),/fail_update/);
 assert.equal(m.records().get('a').trashedAt,undefined);
});
