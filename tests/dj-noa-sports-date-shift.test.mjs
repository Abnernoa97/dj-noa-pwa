import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextDate, shiftIsoUtcDate} from '../worker/src/sports/shared/espnCore.ts';
test('sport days use same UTC date-shift algorithm, including leap years',()=>{
 assert.equal(nextDate('2024-02-28'),'2024-02-29');
 assert.equal(shiftIsoUtcDate('2024-02-29',1),'2024-03-01');
 assert.equal(shiftIsoUtcDate('2026-11-18',-55),'2026-09-24');
 assert.equal(shiftIsoUtcDate('2026-12-31',1),'2027-01-01');
 assert.equal(nextDate('2026-11-18'),shiftIsoUtcDate('2026-11-18',1));
});
test('live feeds delegate UTC dates while MLB/NBA retain next-day function',()=>{
 const live=readFileSync(new URL('../worker/src/sports/sportsLive.ts',import.meta.url),'utf8');
 assert.match(live,/shiftIsoUtcDate as shiftDate/);
 assert.doesNotMatch(live,/function shiftDate\(/);
 for(const p of ['mlb','nba']){
  const code=readFileSync(new URL('../worker/src/sports/'+p+'.ts',import.meta.url),'utf8');
  assert.match(code,/nextDate/);
 }
});
