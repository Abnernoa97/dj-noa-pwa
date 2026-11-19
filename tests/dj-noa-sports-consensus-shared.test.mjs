import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { marketConsensus } from '../worker/src/sports/shared/espnCore.ts';
test('Live shares ESPN market consensus, including one-book rule and probability rounding',()=>{
 assert.deepEqual(marketConsensus([]),{});
 assert.deepEqual(marketConsensus([{provider:'A',away:+115,home:-130}]),{away:115,home:-130});
 const books=[{provider:'A',away:110,home:-120},{provider:'B',away:130,home:-140}];
 const result=marketConsensus(books);
 assert.equal(typeof result.away,'number');
 assert.equal(typeof result.home,'number');
 assert.ok(result.away>0);
 assert.ok(result.home<0);
});
test('sportsLive has no second probability/consensus implementation',()=>{
 const src=readFileSync(new URL('../worker/src/sports/sportsLive.ts',import.meta.url),'utf8');
 assert.match(src,/marketConsensus as consensus/);
 for(const fn of ['impliedProbability','americanFromProbability','consensus']) assert.doesNotMatch(src,new RegExp('\\bfunction '+fn+'\\('));
});
