import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('PWA allows orientation changes but Excel alone requests landscape', () => {
  const manifest = file('vite.config.ts');
  const orientation = file('src/useExcelLandscape.ts');
  const app = file('src/App.tsx');
  assert.match(manifest, /orientation: 'any'/);
  assert.match(orientation, /orientation\.lock\('landscape'\)/);
  assert.match(orientation, /orientation\.lock\('portrait'\)/);
  assert.match(orientation, /document\.body\.classList\.add\('excel-landscape-scope'\)/);
  assert.match(orientation, /document\.body\.classList\.remove\('excel-landscape-scope'\)/);
  assert.match(app, /useExcelLandscape\(view === 'sheet'/);
  assert.doesNotMatch(app, /useExcelLandscape\(true\)/);
});

test('unsupported screen orientation lock never breaks Excel; users can retry', () => {
  const orientation = file('src/useExcelLandscape.ts');
  const sheet = file('src/SheetWorkspace.tsx');
  assert.match(orientation, /typeof orientation\.lock !== 'function'/);
  assert.match(orientation, /catch \{/);
  assert.match(orientation, /window\.addEventListener\('resize', updateViewport\)/);
  assert.match(sheet, /landscapePortrait && <div className="excel-landscape-hint"/);
  assert.match(sheet, /onClick=\{onLandscapeRequest\}/);
  assert.match(sheet, /Gira el teléfono/);
});

test('landscape layout is isolated, preserves native navigation and independent table scrolling', () => {
  const style = file('src/excel-landscape.css');
  const entry = file('src/main.tsx');
  const grid = file('src/ExcelModulesEnhancer.tsx');
  assert.match(entry, /import '\.\/excel-landscape\.css'/);
  assert.match(style, /@media \(orientation: landscape\)/);
  assert.match(style, /body\.excel-landscape-scope \.ios-shell/);
  assert.match(style, /\.excel-grid-scroll/);
  assert.match(style, /overflow-x:auto!important/);
  assert.match(style, /overflow-y:auto!important/);
  assert.match(style, /position:sticky!important/);
  assert.match(style, /\.bottom-nav/);
  assert.doesNotMatch(style, /transform:\s*rotate\(/);
  assert.match(grid, /minmax\(112px, 1fr\)/);
});
