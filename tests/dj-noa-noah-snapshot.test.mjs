import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasCellValue,columnSnapshot} from '../src/domains/noah/noahSheetSnapshot.ts';

test('Noah sheet snapshots retain column identity, order, behavior and 80-column cap',()=>{
 const cols=Array.from({length:84},(_,i)=>({
  id:'col-'+i,name:'Column '+i,key:'key'+i,type:'number',position:i,
  ...(i===1?{behavior:'income'}:{})
 }));
 const values=columnSnapshot(cols);
 assert.equal(values.length,80);
 assert.deepEqual(values[0],{id:'col-0',name:'Column 0',key:'key0',type:'number',behavior:'neutral',position:0});
 assert.equal(values[1].behavior,'income');
 assert.equal(values[79].id,'col-79');
 assert.ok(!('formula' in values[1]));
});
test('Noah cell emptiness preserves existing null/empty rules without silently removing zero or false',()=>{
 assert.equal(hasCellValue(undefined),false);
 assert.equal(hasCellValue(null),false);
 assert.equal(hasCellValue(''),false);
 assert.equal(hasCellValue(0),true);
 assert.equal(hasCellValue(false),true);
 assert.equal(hasCellValue('0'),true);
 assert.equal(hasCellValue({foo:'bar'}),true);
});
test('Noah voice and vision delegate to the same immutable sheet snapshot methods',()=>{
 for(const name of ['NoahVoice','NoahImageIntake']){
  const path='../src/features/noah/'+name+'.tsx';
  const code=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.match(code,/from '\.\.\/\.\.\/domains\/noah\/noahSheetSnapshot'/);
  assert.doesNotMatch(code,/\bfunction (hasCellValue|sheetColumnSnapshot|columnSnapshot)\(/);
 }
});
