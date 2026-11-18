import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toggleSetMember, addSetMember } from '../src/shared/collectionOps.ts';
import { replacePhotoPreviews, clearPhotoPreviews } from '../src/services/media/photoPreviews.ts';
test('shared immutable selection keeps original Set and toggle insertion behavior',()=>{
 const original=new Set(['a','b']);
 const removed=toggleSetMember(original,'a');
 assert.deepEqual([...removed],['b']);
 assert.deepEqual([...original],['a','b']);
 assert.deepEqual([...toggleSetMember(removed,'a')],['b','a']);
});
test('preview owner creates object URLs and releases by caller request',()=>{
 const old=[{url:URL.createObjectURL(new Blob(['old']))}];
 const next=replacePhotoPreviews(old,[{blob:new Blob(['new']),id:'p1'}]);
 assert.equal(next.length,1);
 assert.equal(next[0].id,'p1');
 assert.match(next[0].url,/^blob:/);
 assert.deepEqual(clearPhotoPreviews(next),[]);
});
test('Events and Excel only delegate preview replacement and Set updates',()=>{
 for(const p of ['src/features/events/EventWorkspace.tsx','src/features/excel/SheetWorkspace.tsx']){
  const s=readFileSync(new URL('../'+p,import.meta.url),'utf8');
  assert.match(s,/from '\.\.\/\.\.\/services\/media\/photoPreviews'/);
  assert.match(s,/toggleSetMember\(current, id\)/);
  assert.doesNotMatch(s,/const next = new Set\(current\)/);
  assert.doesNotMatch(s,/return stored\.map\(\(photo\) =>/);
 }
});

test('long-press insertion uses immutable Set and never toggles existing selection off',()=>{
 const original=new Set(['a']);
 assert.deepEqual([...addSetMember(original,'a')],['a']);
 assert.deepEqual([...addSetMember(original,'b')],['a','b']);
 assert.deepEqual([...original],['a']);
});
