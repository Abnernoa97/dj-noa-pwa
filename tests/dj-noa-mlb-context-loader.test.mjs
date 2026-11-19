import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMlbGameContextLoader} from '../worker/src/sports/shared/contextCore.ts';

test('both MLB surfaces share schedule, probable pitchers, published batting order',async()=>{
 let calls=0;
 const fetch=async url=>{
  calls++;
  if(url.includes('/schedule?'))return {dates:[{games:[{gamePk:101,teams:{
   away:{team:{name:'Away'},probablePitcher:{fullName:'Pitcher A'}},
   home:{team:{name:'Home'},probablePitcher:{fullName:'Pitcher B'}}
  }}]}]};
  if(url.includes('/game/101/boxscore'))return {teams:{
   away:{battingOrder:['1'],players:{ID1:{person:{fullName:'Batter A'}}}},
   home:{battingOrder:['2'],players:{ID2:{person:{fullName:'Batter B'}}}}
  }};
  throw new Error('unexpected fetch');
 };
 const load=createMlbGameContextLoader(fetch,(team,name)=>team.name===name);
 const result=await load('2026-11-18','Away','A','Home','H');
 assert.deepEqual(result.probablePitchers,{away:'Pitcher A',home:'Pitcher B'});
 assert.deepEqual(result.lineups,{away:['Batter A'],home:['Batter B'],status:'published'});
 assert.equal(calls,2);
});
test('unmatched game returns unavailable with no fabricated starters',async()=>{
 const load=createMlbGameContextLoader(async()=>({dates:[{games:[]}]}),()=>false);
 assert.deepEqual(await load('2026-11-18','Away','A','Home','H'),{probablePitchers:{},lineups:{away:[],home:[],status:'unavailable'}});
});
test('live and context retain distinct matching and upstream fetch implementations',()=>{
 const a=readFileSync(new URL('../worker/src/sports/sportsContext.ts',import.meta.url),'utf8');
 const b=readFileSync(new URL('../worker/src/sports/sportsLive.ts',import.meta.url),'utf8');
 assert.match(a,/createMlbGameContextLoader\(getJson, matchTeam\)/);
 assert.match(b,/createMlbGameContextLoader\(getJson, teamMatches\)/);
 assert.doesNotMatch(a,/async function loadMlbGameContext\(/);
 assert.doesNotMatch(b,/async function loadMlbGameContext\(/);
});
