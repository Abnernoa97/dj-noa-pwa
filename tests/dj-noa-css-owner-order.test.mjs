import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const css=[...entry.matchAll(/^import '\.\/([^']+\.css)';$/gm)].map(x=>x[1]);
test('CSS single-entry cascade has no repeated imports and keeps critical last layers',()=>{
 assert.equal(new Set(css).size,css.length);
 assert.equal(css[0],'styles/core/styles.css');
 assert.equal(css.at(-2),'styles/core/ios-dark-redesign.css');
 assert.equal(css.at(-1),'features/excel/styles/excel-landscape.css');
 const idx=x=>css.indexOf(x);
 assert.ok(idx('styles/core/visual-polish.css')<idx('features/excel/styles/excel-scroll-fix.css'));
 assert.ok(idx('features/excel/styles/excel-scroll-fix.css')<idx('features/excel/styles/sheet-focus.css'));
 assert.ok(idx('styles/core/scroll-fix.css')<idx('features/calendar/styles/calendar-focus.css'));
});
test('each loaded stylesheet belongs to a feature or core CSS chapter',()=>{
 for(const path of css)assert.match(path,/^(?:styles\/core|features\/[^/]+\/styles)\/[^/]+\.css$/);
});
