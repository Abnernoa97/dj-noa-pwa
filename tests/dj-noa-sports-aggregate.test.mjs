import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aggregateForm} from '../worker/src/sports/shared/contextCore.ts';
test('recent form aggregation is shared, ordered and counts wins/losses',()=>{
 assert.deepEqual(aggregateForm([]),{wins:0,losses:0,sequence:[]});
 assert.deepEqual(aggregateForm([{result:'W'},{result:'L'},{result:'W'}]),{wins:2,losses:1,sequence:['W','L','W']});
});
test('live and context use one W/L aggregator',()=>{
 for(const file of ['sportsContext','sportsLive']){
  const src=readFileSync(new URL('../worker/src/sports/'+file+'.ts',import.meta.url),'utf8');
  assert.match(src,/aggregateForm\(recent/);assert.doesNotMatch(src,/const aggregate = \(items:/);
 }
});
