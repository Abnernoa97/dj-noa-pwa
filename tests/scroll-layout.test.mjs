import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('global scroll fix loads last so it wins the CSS cascade', () => {
  const main = read('src/main.tsx');
  const visual = main.indexOf("import './visual-polish.css';");
  const excel = main.indexOf("import './excel-scroll-fix.css';");
  const global = main.indexOf("import './scroll-fix.css';");
  assert.ok(visual >= 0);
  assert.ok(excel >= 0);
  assert.ok(global > visual);
  assert.ok(global > excel);
});

test('main content is the single vertical touch scroll surface', () => {
  const css = read('src/scroll-fix.css');
  assert.match(css, /\.content\s*\{[\s\S]*overflow-y:auto!important/);
  assert.match(css, /\.content\s*\{[\s\S]*touch-action:pan-y!important/);
  assert.match(css, /-webkit-overflow-scrolling:touch/);
});

test('events reminders calendar and Excel are allowed to grow vertically', () => {
  const css = read('src/scroll-fix.css');
  for (const selector of ['.events-page', '.reminders-workspace', '.calendar-page', '.sheet-classic']) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(css, /height:auto!important/);
  assert.match(css, /overflow:visible!important/);
  assert.match(css, /\.excel-body\s*\{[\s\S]*overflow-y:visible!important/);
});
