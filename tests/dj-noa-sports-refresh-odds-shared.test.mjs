import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('MLB/NBA share their refresh lifecycle but retain separate loads and caches', () => {
 const hook=readFileSync(new URL('../src/features/sports/useSportsAutoRefresh.ts',import.meta.url),'utf8');
 assert.match(hook,/3 \* 60 \* 1000/);
 assert.match(hook,/return \(\) => window\.clearInterval\(timer\)/);
 for(const name of ['MlbWorkspace','NbaWorkspace']){
  const code=readFileSync(new URL('../src/features/sports/'+name+'.tsx',import.meta.url),'utf8');
  assert.match(code,/useSportsAutoRefresh\(load\)/);
  assert.doesNotMatch(code,/setInterval\(\(\) => void load\(false\)/);
  assert.match(code,/const load = useCallback/);
 }
});

test('MLB/NBA odds rows share identical rendering and five-provider cap', () => {
 const component=readFileSync(new URL('../src/features/sports/SportsBookRows.tsx',import.meta.url),'utf8');
 assert.match(component,/books\.slice\(0, 5\)/);
 assert.match(component,/favoriteFromOdds\(book\.away, book\.home\)/);
 for(const name of ['MlbWorkspace','NbaWorkspace']){
  const src=readFileSync(new URL('../src/features/sports/'+name+'.tsx',import.meta.url),'utf8');
  assert.match(src,/<SportsBookRows gameId=\{game\.id\} books=\{game\.books\}/);
  assert.doesNotMatch(src,/game\.books\.slice\(0, 5\)\.map/);
 }
});
