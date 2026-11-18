import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');

test('all sports UI and odds files have only one canonical chapter location',()=>{
const files={
 'src/MlbWorkspace.tsx':'src/features/sports/MlbWorkspace.tsx',
 'src/NbaWorkspace.tsx':'src/features/sports/NbaWorkspace.tsx',
 'src/SportsEnhancer.tsx':'src/features/sports/SportsEnhancer.tsx',
 'src/SportsGameDetail.tsx':'src/features/sports/SportsGameDetail.tsx',
 'src/HardRockMarketEnhancer.tsx':'src/features/sports/HardRockMarketEnhancer.tsx',
 'src/hardRockOdds.ts':'src/domains/sports/hardRockOdds.ts'
};
for(const [oldPath,canonical]of Object.entries(files)){
 assert.equal(existsSync(new URL(oldPath,root)),false,'Duplicate sports file '+oldPath);
 assert.ok(existsSync(new URL(canonical,root)),'Missing sports chapter '+canonical);
}
});
test('sports entrypoints and the Hard Rock odds calculation retain their routes',()=>{
 const app=read('src/App.tsx'),main=read('src/main.tsx'),hard=read('src/features/sports/HardRockMarketEnhancer.tsx');
 assert.match(app,/from '\.\/features\/sports\/MlbWorkspace'/);
 assert.match(main,/from '\.\/features\/sports\/SportsEnhancer'/);
 assert.match(main,/from '\.\/features\/sports\/HardRockMarketEnhancer'/);
 assert.match(hard,/from '\.\.\/\.\.\/domains\/sports\/hardRockOdds'/);
});
