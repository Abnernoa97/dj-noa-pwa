import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {odd,impliedProbability,favoriteFromOdds,favoriteForGame,shortTeamName,gameClock,dateLabel,marketLabel} from '../src/features/sports/sportsPresentation.ts';

const game=(overrides={})=>({
 startTime:'2026-11-18T18:00:00Z',status:'scheduled',statusText:'',
 books:[],consensusAway:-115,consensusHome:105,...overrides
});
test('one sports card formatter retains zero/positive/negative display and favorite threshold',()=>{
 assert.equal(odd(100.6),'+101');
 assert.equal(odd(-110.4),'-110');
 assert.equal(odd(Infinity),'—');
 assert.equal(odd(), '—');
 assert.equal(impliedProbability(0),0);
 assert.equal(impliedProbability(-100),0.5);
 assert.equal(impliedProbability(100),0.5);
 assert.equal(favoriteFromOdds(-120,100),'away');
 assert.equal(favoriteFromOdds(100,-120),'home');
 assert.equal(favoriteFromOdds(-110,-110),null);
 assert.equal(favoriteForGame(game({books:[]})),'away');
 assert.equal(favoriteForGame(game({books:[{provider:'A',away:120,home:-110},{provider:'B',away:120,home:-110}]})),'home');
 assert.equal(favoriteForGame(game({books:[{provider:'A',away:-120,home:100},{provider:'B',away:100,home:-120}]})),'away'); // vote tie -> consensus
});
test('one sports card clock and market label preserve status, locale and provider',()=>{
 assert.equal(gameClock(game({status:'live',statusText:''})),'EN VIVO');
 assert.equal(gameClock(game({status:'final',statusText:''})),'FINAL');
 assert.equal(gameClock(game({status:'scheduled',startTime:'no-date',statusText:''})),'Programado');
 assert.equal(shortTeamName('New York Yankees'),'Yankees');
 assert.equal(shortTeamName('Rangers'),'Rangers');
 assert.equal(marketLabel(game({books:[]})),'MERCADO');
 assert.equal(marketLabel(game({books:[{provider:'Bet One',away:-110,home:100}]})),'BET ONE');
 assert.equal(marketLabel(game({books:[{provider:'A',away:-110,home:100},{provider:'B',away:-110,home:100}]})),'PROMEDIO');
 assert.equal(dateLabel('2026-11-18'),'18 de noviembre');
 assert.equal(dateLabel('invalid'),'invalid');
});
test('MLB and NBA own only their distinct caching/network/visual code',()=>{
 for(const league of ['Mlb','Nba']){
  const code=readFileSync(new URL('../src/features/sports/'+league+'Workspace.tsx',import.meta.url),'utf8');
  assert.match(code,/from '\.\/sportsPresentation'/);
  for(const helper of ['odd','impliedProbability','favoriteFromOdds','favoriteForGame','shortTeamName','gameClock','dateLabel','marketLabel']){
   assert.doesNotMatch(code,new RegExp('\\bfunction '+helper+'\\('),'local clone of '+helper);
  }
  assert.match(code,/const CACHE_KEY =/); // league-specific keys must never merge
 }
});
