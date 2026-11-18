import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('the single application coordinator and native back handler live in src/app', () => {
  for (const file of ['App.tsx', 'navigationBack.ts']) {
    assert.equal(existsSync(new URL('src/' + file, root)), false, 'legacy duplicate ' + file);
    assert.equal(existsSync(new URL('src/app/' + file, root)), true, 'missing chapter file ' + file);
  }
  const entry = read('src/main.tsx');
  assert.match(entry, /import App from '\.\/app\/App'/);
});

test('one navigation implementation serves all chapters without changing the database', () => {
  const app = read('src/app/App.tsx');
  const home = read('src/app/HomeView.tsx');
  const sheet = read('src/features/excel/SheetWorkspace.tsx');
  const events = read('src/features/events/EventWorkspace.tsx');
  assert.match(app, /from '\.\/navigationBack'/);
  assert.match(home, /from '\.\/navigationBack'/);
  assert.match(sheet, /from '\.\.\/\.\.\/app\/navigationBack'/);
  assert.match(events, /from '\.\.\/\.\.\/app\/navigationBack'/);
  assert.match(read('src/db.ts'), /super\('dj-noa-local'\)/);
});
