import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('the only local database implementation belongs to the storage chapter', () => {
  assert.equal(existsSync(new URL('src/db.ts', root)), false, 'legacy root database copy');
  const schema = read('src/services/storage/db.ts');
  assert.match(schema, /super\('dj-noa-local'\)/);
  const versions = [...schema.matchAll(/this\.version\((\d+)\)/g)].map(x => Number(x[1]));
  assert.deepEqual(versions, [1, 2, 3, 4, 5, 6]);
  for (const table of ['events', 'eventPhotos', 'reminders', 'sheetRows', 'sheetColumns', 'sheetPhotos', 'history']) {
    assert.match(schema, new RegExp('\\b'+table+'!:\\s*Table<'), table);
  }
  assert.match(read('src/services/storage/dataBackup.ts'), /from '\.\/db'/);
});

test('storage stays linked to existing event and Excel modules without creating a second Dexie DB', () => {
  for (const path of [
    'src/app/App.tsx',
    'src/domains/events/eventMutations.ts',
    'src/domains/noah/noahVisionCommit.ts',
    'src/features/excel/SheetWorkspace.tsx',
    'src/features/events/EventWorkspace.tsx'
  ]) assert.match(read(path), /services\/storage\/db/, path);
  assert.match(read('scripts/audit-structure.mjs'), /src\/services\/storage\/db\.ts/);
});
