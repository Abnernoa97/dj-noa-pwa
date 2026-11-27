import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/app/HomeView.tsx',import.meta.url),'utf8');

test('Home navigation uses the same history-aware router as bottom navigation',()=>{
 assert.match(app,/onView=\{navigateTo\}/);
 assert.match(app,/viewHistoryRef\.current\.push\(viewRef\.current\)/);
 assert.match(app,/viewRef\.current = next/);
 assert.doesNotMatch(app,/onView=\{setView\}/);
 assert.match(app,/const previous = viewHistoryRef\.current\.pop\(\) \|\| 'home'/);
});
test('NBA does not import at initial Home load and remains operable with back and offline PWA JS chunk',()=>{
 assert.match(home,/lazy\(\(\) => import\('\.\.\/features\/sports\/NbaWorkspace'\)\)/);
 assert.doesNotMatch(home,/^import NbaWorkspace from/m);
 assert.match(home,/useNativeBack\(nbaOpen, \(\) => setNbaOpen\(false\), 50\)/);
 assert.match(home,/<Suspense fallback=/);
 assert.match(home,/onBack=\{\(\) => setNbaOpen\(false\)\}/);
});
