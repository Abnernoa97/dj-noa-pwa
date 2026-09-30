import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBulkSheetDelete } from '../src/assistantBulkDelete.ts';

const rows = [
  { id: 'row-1', label: 'Audio', category: 'Inversión', amount: 8000, status: 'pending', createdAt: '2026-09-29T00:00:00.000Z' },
  { id: 'row-2', label: 'Anticipo', category: 'Ganancia', amount: 12000, status: 'paid', createdAt: '2026-09-29T00:00:00.000Z' }
];

test('borrar todo lo de Excel always asks for confirmation first', () => {
  const result = resolveBulkSheetDelete('Borra todo lo de Excel', { sheetRows: rows }, []);
  assert.ok(result);
  assert.deepEqual(result.actions, [{ type: 'none' }]);
  assert.match(result.reply, /todos los registros de Excel/i);
  assert.match(result.reply, /¿Confirmas\?/);
});

test('confirmation converts the pending request into one atomic clear action', () => {
  const history = [{
    command: 'Borra todo lo de Excel',
    result: 'Voy a borrar todos los registros de Excel y sus fotos. Las columnas se conservarán. ¿Confirmas?'
  }];
  const result = resolveBulkSheetDelete('sí', { sheetRows: rows }, history);
  assert.ok(result);
  assert.deepEqual(result.actions, [{ type: 'clear_sheet_rows' }]);
});

test('common full-clear phrases resolve deterministically without asking the model', () => {
  for (const command of [
    'Vacía Excel',
    'Limpia todo el Excel',
    'Bórrame todas las filas de Excel',
    'Elimina todos los registros de la tabla',
    'Deja Excel en blanco'
  ]) {
    const result = resolveBulkSheetDelete(command, { sheetRows: rows }, []);
    assert.ok(result, command);
    assert.deepEqual(result.actions, [{ type: 'none' }], command);
  }
});

test('filtered or ambiguous deletions do not trigger the full clear path', () => {
  assert.equal(resolveBulkSheetDelete('Borra las inversiones de junio de Excel', { sheetRows: rows }, []), null);
  assert.equal(resolveBulkSheetDelete('Borra esta fila', { sheetRows: rows }, []), null);
  assert.equal(resolveBulkSheetDelete('Quita lo pendiente', { sheetRows: rows }, []), null);
});

test('an already empty Excel does not pretend to delete data', () => {
  const result = resolveBulkSheetDelete('Borra todo lo de Excel', { sheetRows: [] }, []);
  assert.ok(result);
  assert.equal(result.reply, 'Excel ya está vacío.');
  assert.deepEqual(result.actions, [{ type: 'none' }]);
});

test('clear action implementation deletes rows and photos atomically and updates UI state', () => {
  const source = readFileSync(new URL('../src/app/actionExecutor.ts', import.meta.url), 'utf8');
  assert.match(source, /action\.type === 'clear_sheet_rows'/);
  assert.match(source, /db\.transaction\('rw', \[db\.sheetRows, db\.sheetPhotos\]/);
  assert.match(source, /db\.sheetPhotos\.clear\(\)/);
  assert.match(source, /db\.sheetRows\.clear\(\)/);
  assert.match(source, /context\.setSheetRows\(\[\]\)/);
  assert.match(source, /context\.setSelectedSheetRowId\(null\)/);
});
