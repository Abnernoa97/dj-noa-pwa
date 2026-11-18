import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('shared interfaces have a single source, with no duplicate root types module', () => {
  assert.equal(existsSync(new URL('src/types.ts', root)), false);
  assert.ok(existsSync(new URL('src/shared/types.ts', root)));
  const code = read('src/shared/types.ts');
  for (const tag of ['EventItem', 'ReminderItem', 'SheetRow', 'SheetColumn', 'EventPhoto', 'SheetPhoto', 'AppView']) {
    assert.match(code, new RegExp('(?:export interface|export type) '+tag+'\\b'), tag);
  }
  assert.match(code, /CurrencyCode = 'MXN' \| 'USD'/);
});

test('App, storage and finance use the canonical shared types without redefining contracts', () => {
  for (const path of [
    'src/app/App.tsx',
    'src/services/storage/db.ts',
    'src/services/storage/dataBackup.ts',
    'src/domains/finance/moneyIntegrity.ts',
    'src/features/excel/SheetWorkspace.tsx',
  ]) assert.match(read(path), /shared\/types/, path);
  assert.match(read('scripts/audit-structure.mjs'), /src\/shared\/types\.ts/);
});
