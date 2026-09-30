import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/excel-scroll-fix.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('Excel owns one natural vertical touch scroller', () => {
  assert.match(css, /\.sheet-classic\s*\{[^}]*overflow-y:auto!important/s);
  assert.match(css, /touch-action:pan-y!important/);
  assert.match(css, /\.sheet-classic \.excel-body\s*\{[^}]*max-height:none!important/s);
  assert.match(css, /\.sheet-classic \.excel-body\s*\{[^}]*overflow:visible!important/s);
});

test('Excel scroll fix loads after the visual polish layer', () => {
  const visual = main.indexOf("import './visual-polish.css'");
  const scroll = main.indexOf("import './excel-scroll-fix.css'");
  assert.ok(visual >= 0);
  assert.ok(scroll > visual);
});
