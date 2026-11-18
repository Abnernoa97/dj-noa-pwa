import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEspnEvent,createTeamView} from '../worker/src/sports/shared/espnCore.ts';

test('ESPN event parser keeps game data and teams without inventing absent games',()=>{
 const view=createTeamView((_name,supplied)=>supplied||'NA');
 const event={id:'game01',date:'2026-11-19T21:00:00Z',status:{type:{state:'in',shortDetail:'Q2'}},competitions:[{venue:{fullName:'Arena'},competitors:[{homeAway:'away',team:{displayName:'Away',abbreviation:'AWY'},score:'2'},{homeAway:'home',team:{displayName:'Home',abbreviation:'HME'},score:'3'}]}]};
 const parsed=parseEspnEvent(event,view);
 assert.equal(parsed?.id,'game01');
 assert.equal(parsed?.away.abbreviation,'AWY');
 assert.equal(parsed?.home.abbreviation,'HME');
 assert.equal(parsed?.status,'live');
 assert.equal(parsed?.venue,'Arena');
 assert.equal(parseEspnEvent({id:'empty',competitions:[{}]},view),null);
});
test('MLB and NBA use one ESPN parser, preserve their own sort and fallback',()=>{
 for(const name of ['mlb','nba']){
  const src=readFileSync(new URL('../worker/src/sports/'+name+'.ts',import.meta.url),'utf8');
  assert.match(src,/parseEspnEvent\(raw, teamView\)/);
  assert.doesNotMatch(src,/const awayRaw = competitors\.find/);
 }
});
