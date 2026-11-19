import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playerName,lineupFromBoxscoreSide} from '../worker/src/sports/shared/contextCore.ts';

test('MLB player name fallback remains ordered and non-invented',()=>{
 assert.equal(playerName({fullName:'Ana',displayName:'B'}),'Ana');
 assert.equal(playerName({displayName:'B'}),'B');
 assert.equal(playerName({name:'C'}),'C');
 assert.equal(playerName(null),'');
});
test('MLB boxscore lineup keeps explicit battingOrder and maximum nine names',()=>{
 const players={};
 for(let i=1;i<=12;i++)players['ID'+i]={person:{displayName:'Player '+i}};
 const roster={players,battingOrder:[12,1,2,3,4,5,6,7,8,9,10,11]};
 assert.deepEqual(lineupFromBoxscoreSide(roster),
   ['Player 12','Player 1','Player 2','Player 3','Player 4','Player 5','Player 6','Player 7','Player 8']);
 assert.deepEqual(lineupFromBoxscoreSide({players,battingOrder:[99,1]}),['Player 1']);
 assert.deepEqual(lineupFromBoxscoreSide({players,battingOrder:['ID1']}),['Player 1']);
 assert.deepEqual(lineupFromBoxscoreSide({}),[]);
});
test('live and context delegate lineup parsing through the single MLB game context loader',()=>{
 for(const file of ['sportsContext','sportsLive']){
  const code=readFileSync(new URL('../worker/src/sports/'+file+'.ts',import.meta.url),'utf8');
  assert.match(code,/createMlbGameContextLoader/);
  assert.doesNotMatch(code,/\bfunction (playerName|lineupFromBoxscoreSide|loadMlbGameContext)\(/);
 }
 const shared=readFileSync(new URL('../worker/src/sports/shared/contextCore.ts',import.meta.url),'utf8');
 assert.match(shared,/createMlbGameContextLoader/);
 assert.match(shared,/lineupFromBoxscoreSide\(rec\(boxTeams\.away\)\)/);
 assert.match(shared,/playerName\(rec\(teams\.away\)\.probablePitcher\)/);
});
