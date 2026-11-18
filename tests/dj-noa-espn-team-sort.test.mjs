import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTeamView,compareGameStartTime} from '../worker/src/sports/shared/espnCore.ts';

test('ESPN team view shares its body but retains league-specific abbreviation rules',()=>{
 const mlb=createTeamView((name,provided)=>provided || (name==='New York Yankees'?'NYY':'X'));
 const nba=createTeamView((name,provided)=>provided || name.split(/\s+/).map(s=>s[0]).join(''));
 const item={team:{displayName:'New York Yankees',logo:'logo.png'},score:'3'};
 assert.deepEqual(mlb(item),{name:'New York Yankees',abbreviation:'NYY',logo:'logo.png',score:'3'});
 assert.equal(nba(item).abbreviation,'NYY');
 assert.equal(mlb({team:{abbreviation:'ABC',name:'X'}}).abbreviation,'ABC');
});
test('comparison keeps invalid dates last and preserves MLB mutating vs NBA copied sort',()=>{
 const a={startTime:'2026-11-18T12:00:00Z'},b={startTime:'bad'},c={startTime:'2026-11-17T12:00:00Z'};
 assert.ok(compareGameStartTime(a,b)<0);
 assert.ok(compareGameStartTime(c,a)<0);
 const codeM=readFileSync(new URL('../worker/src/sports/mlb.ts',import.meta.url),'utf8');
 const codeN=readFileSync(new URL('../worker/src/sports/nba.ts',import.meta.url),'utf8');
 assert.match(codeM,/games\.sort\(compareGameStartTime\)/);
 assert.match(codeN,/\[\.\.\.games\]\.sort\(compareGameStartTime\)/);
 for(const code of [codeM,codeN]){assert.match(code,/createTeamView\(abbr\)/);assert.doesNotMatch(code,/function teamView\(/);}
});
