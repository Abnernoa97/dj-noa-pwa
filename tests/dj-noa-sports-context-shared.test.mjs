import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize, dateOnly} from '../worker/src/sports/shared/contextCore.ts';

test('sports context identity and ISO lexical date rules are unchanged',()=>{
 assert.equal(normalize('New York Yankees'),'newyorkyankees');
 assert.equal(normalize('S.F. Giants 2026!'),'sfgiants2026');
 assert.equal(dateOnly('2026-11-18T21:03:00Z'),'2026-11-18');
 assert.equal(dateOnly('2026-11-18'),'2026-11-18');
 assert.equal(dateOnly('18/11/2026'),'');
 assert.equal(dateOnly('2026-99-99T12:00:00'),'2026-99-99');
});
test('context, live and analysis delegate to one shared parser',()=>{
 for(const name of ['sportsContext','sportsLive','sportsAnalysis']){
  const code=readFileSync(new URL('../worker/src/sports/'+name+'.ts',import.meta.url),'utf8');
  assert.match(code,/from '\.\/shared\/espnCore'/);
  for(const helper of (name==='sportsAnalysis'?['rec','str']:['rec','list','str','num'])){
   assert.doesNotMatch(code,new RegExp('\\bfunction '+helper+'\\('),'duplicate '+helper+' in '+name);
  }
  if(name!=='sportsAnalysis'){
   assert.match(code,/from '\.\/shared\/contextCore'/);
   assert.doesNotMatch(code,/\bfunction (normalize|dateOnly)\(/);
  }
  if(name==='sportsLive')assert.doesNotMatch(code,/\bfunction statusView\(/);
 }
});
