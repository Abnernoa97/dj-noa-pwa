import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),'utf8');
test('all sports Worker handlers live only in the dedicated sports chapter',()=>{
 const names=['mlb','nba','sportsAnalysis','sportsContext','sportsLive'];
 const entry=read('worker/src/entry.ts');
 for(const name of names){
  assert.ok(existsSync(new URL('worker/src/sports/'+name+'.ts',root)));
  assert.equal(existsSync(new URL('worker/src/'+name+'.ts',root)),false);
  assert.ok(entry.includes("'./sports/"+name+"'"), 'entry must import '+name);
 }
 const config=JSON.parse(read('wrangler.jsonc'));
 assert.equal(config.main,'worker/src/entry.ts');
 for(const route of ['/api/mlb','/api/nba','/api/sports-context','/api/sports-live','/api/sports-analysis']){
  assert.ok(entry.includes("'"+route+"'"), 'route still active: '+route);
 }
});
