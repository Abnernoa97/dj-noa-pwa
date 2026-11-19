import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scrollFix = readFileSync(new URL('../src/features/excel/styles/excel-scroll-fix.css', import.meta.url), 'utf8');
const sheetFocus = readFileSync(new URL('../src/features/excel/styles/sheet-focus.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('Excel owns one natural vertical touch scroller across the loaded stylesheet cascade', () => {
  // The later sheet-focus.css owns these exact same !important values.
  // Do not restore redundant earlier declarations just to satisfy a file-local assertion.
  assert.match(sheetFocus, /\.sheet-classic\s*\{[^}]*overflow-y:auto!important/s);
  assert.match(sheetFocus, /\.sheet-classic\s*\{[^}]*touch-action:pan-y!important/s);
  assert.match(sheetFocus, /\.sheet-classic\s*\.excel-body\s*\{[^}]*max-height:none!important/s);
  assert.match(sheetFocus, /\.sheet-classic\s*\.excel-body\s*\{[^}]*overflow:visible!important/s);
  assert.match(scrollFix, /touch-action:pan-y!important/);
  assert.match(scrollFix, /\.sheet-classic\s*\.excel-body\s*\{[^}]*overscroll-behavior:auto!important/s);
});

test('Excel scroll refinements load after visual polish and the sheet-focus owner loads after both', () => {
  const visual = main.indexOf("import './styles/core/visual-polish.css'");
  const scroll = main.indexOf("import './features/excel/styles/excel-scroll-fix.css'");
  const owner = main.indexOf("import './features/excel/styles/sheet-focus.css'");
  assert.ok(visual >= 0);
  assert.ok(scroll > visual);
  assert.ok(owner > scroll);
});
