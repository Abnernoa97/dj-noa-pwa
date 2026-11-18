import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {json} from '../worker/src/shared/http.ts';
test('shared JSON sets no-store headers, status and optional extra headers',async()=>{
 const r=json({ok:true},207,{'x-test':'yes'});
 assert.equal(r.status,207);
 assert.equal(r.headers.get('content-type'),'application/json; charset=utf-8');
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('x-test'),'yes');
 assert.deepEqual(await r.json(),{ok:true});
});
test('router, chat, vision and analysis share JSON helper',()=>{
 for(const file of ['entry.ts','noah/noahChat.ts','noah/noahImage.ts','sports/sportsAnalysis.ts','sports/mlb.ts','sports/nba.ts','sports/sportsContext.ts','sports/sportsLive.ts']){
  const s=readFileSync(new URL('../worker/src/'+file,import.meta.url),'utf8');
  assert.match(s,/import \{ json \} from/);
  assert.doesNotMatch(s,/function json\(/);
 }
});
