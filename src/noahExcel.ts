import { db, uid } from './db';
import type { NoahEventAction, NoahEventActionResult } from './noahEvents';
import type { FinancialType, SheetColumn, SheetColumnBehavior, SheetRow, SheetValue } from './types';

export type NoahSheetCellInput = {
  columnId: string;
  value: string | number | boolean | null;
};

export type NoahSheetAction =
  | { type: 'create_sheet_column'; name: string; behavior?: SheetColumnBehavior }
  | { type: 'update_sheet_column'; columnId: string; name?: string; behavior?: SheetColumnBehavior }
  | { type: 'delete_sheet_column'; columnId: string }
  | { type: 'create_sheet_grid_row'; label: string; cells?: NoahSheetCellInput[] }
  | { type: 'rename_sheet_row'; rowId: string; label: string }
  | { type: 'set_sheet_cell'; rowId: string; columnId: string; value: string | number | boolean | null }
  | { type: 'clear_sheet_cell'; rowId: string; columnId: string }
  | { type: 'delete_sheet_row'; rowId: string };

export type NoahChatAction = NoahEventAction | NoahSheetAction;

const SHEET_ACTION_TYPES = new Set<NoahSheetAction['type']>([
  'create_sheet_column',
  'update_sheet_column',
  'delete_sheet_column',
  'create_sheet_grid_row',
  'rename_sheet_row',
  'set_sheet_cell',
  'clear_sheet_cell',
  'delete_sheet_row'
]);

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function behaviorOf(column: SheetColumn): SheetColumnBehavior {
  return column.behavior || 'neutral';
}

function makeColumnKey(name: string) {
  const slug = normalize(name).replace(/\s+/g, '_') || 'columna';
  return `grid_${slug}_${uid().slice(0, 6)}`;
}

function coerceCellValue(column: SheetColumn, value: NoahSheetCellInput['value']): SheetValue {
  if (value === null) return null;
  if (behaviorOf(column) === 'neutral') {
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    return String(value ?? '').slice(0, 900);
  }
  return numberValue(value);
}

function financialPatch(columns: SheetColumn[], values: Record<string, SheetValue>): Pick<SheetRow, 'amount' | 'financialType'> {
  let income = 0;
  let expense = 0;
  let investment = 0;

  for (const column of columns) {
    const behavior = behaviorOf(column);
    if (behavior === 'neutral') continue;
    const value = numberValue(values[column.key]);
    if (behavior === 'income') income += value;
    if (behavior === 'expense') expense += value;
    if (behavior === 'investment') investment += value;
  }

  const net = income - expense - investment;
  const financialType: FinancialType = net > 0 ? 'income' : net < 0 ? 'expense' : 'neutral';
  return { amount: Math.abs(net), financialType };
}

async function recalculateRows(columns: SheetColumn[]) {
  const rows = await db.sheetRows.toArray();
  const now = new Date().toISOString();
  for (const row of rows) {
    const values = { ...(row.values || {}) };
    const patch = financialPatch(columns, values);
    await db.sheetRows.update(row.id, { ...patch, updatedAt: now });
  }
}

function announce(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('djnoa:excel-ai-action', { detail }));
}

export function isNoahSheetAction(action: NoahChatAction): action is NoahSheetAction {
  return SHEET_ACTION_TYPES.has(action.type as NoahSheetAction['type']);
}

export async function executeNoahSheetAction(action: NoahSheetAction): Promise<NoahEventActionResult> {
  if (action.type === 'create_sheet_column') {
    const name = action.name.trim();
    if (!name) return { ok: false, message: 'Falta el nombre de la columna.' };
    const columns = await db.sheetColumns.orderBy('position').toArray();
    const duplicate = columns.find((column) => normalize(column.name) === normalize(name));
    if (duplicate) return { ok: true, message: `La columna ${duplicate.name} ya existe.` };
    const now = new Date().toISOString();
    const behavior = action.behavior || 'neutral';
    const position = columns.length ? Math.max(...columns.map((column) => column.position)) + 1 : 0;
    const column: SheetColumn = {
      id: uid(),
      name,
      key: makeColumnKey(name),
      type: behavior === 'neutral' ? 'text' : 'currency',
      behavior,
      position,
      createdAt: now
    };
    await db.sheetColumns.add(column);
    announce({ type: action.type, columnId: column.id, columnName: column.name });
    return { ok: true, message: `Listo, creé la columna ${name}.` };
  }

  if (action.type === 'update_sheet_column') {
    const column = await db.sheetColumns.get(action.columnId);
    if (!column) return { ok: false, message: 'No encontré esa columna.' };
    const patch: Partial<SheetColumn> = {};
    if (typeof action.name === 'string' && action.name.trim()) patch.name = action.name.trim().slice(0, 120);
    if (action.behavior) {
      patch.behavior = action.behavior;
      patch.type = action.behavior === 'neutral' ? 'text' : 'currency';
    }
    if (!Object.keys(patch).length) return { ok: true, message: 'No había nada que cambiar.' };
    await db.sheetColumns.update(column.id, patch);
    if (action.behavior) {
      const columns = await db.sheetColumns.orderBy('position').toArray();
      await recalculateRows(columns);
    }
    announce({ type: action.type, columnId: column.id, columnName: patch.name || column.name });
    return { ok: true, message: `Listo, actualicé ${patch.name || column.name}.` };
  }

  if (action.type === 'delete_sheet_column') {
    const column = await db.sheetColumns.get(action.columnId);
    if (!column) return { ok: false, message: 'No encontré esa columna.' };
    await db.transaction('rw', [db.sheetColumns, db.sheetRows], async () => {
      await db.sheetColumns.delete(column.id);
      const remaining = await db.sheetColumns.orderBy('position').toArray();
      const rows = await db.sheetRows.toArray();
      const now = new Date().toISOString();
      for (const row of rows) {
        const values = { ...(row.values || {}) };
        delete values[column.key];
        await db.sheetRows.update(row.id, { values, ...financialPatch(remaining, values), updatedAt: now });
      }
    });
    announce({ type: action.type, columnId: column.id, columnName: column.name });
    return { ok: true, message: `Listo, eliminé la columna ${column.name}.` };
  }

  if (action.type === 'create_sheet_grid_row') {
    const columns = await db.sheetColumns.orderBy('position').toArray();
    const columnMap = new Map(columns.map((column) => [column.id, column]));
    const values: Record<string, SheetValue> = {};
    for (const cell of action.cells || []) {
      const column = columnMap.get(cell.columnId);
      if (!column) continue;
      values[column.key] = coerceCellValue(column, cell.value);
    }
    const now = new Date().toISOString();
    const row: SheetRow = {
      id: uid(),
      label: action.label.trim().slice(0, 180) || 'Registro',
      category: 'General',
      status: 'pending',
      currency: 'MXN',
      values,
      ...financialPatch(columns, values),
      createdAt: now,
      updatedAt: now
    };
    await db.sheetRows.add(row);
    announce({ type: action.type, rowId: row.id, rowLabel: row.label, columnIds: (action.cells || []).map((cell) => cell.columnId) });
    return { ok: true, message: `Listo, agregué ${row.label} a Excel.` };
  }

  if (action.type === 'rename_sheet_row') {
    const row = await db.sheetRows.get(action.rowId);
    if (!row) return { ok: false, message: 'No encontré esa fila.' };
    const label = action.label.trim().slice(0, 180);
    if (!label) return { ok: false, message: 'Falta el nuevo nombre.' };
    await db.sheetRows.update(row.id, { label, updatedAt: new Date().toISOString() });
    announce({ type: action.type, rowId: row.id, rowLabel: label });
    return { ok: true, message: `Listo, ahora se llama ${label}.` };
  }

  if (action.type === 'set_sheet_cell' || action.type === 'clear_sheet_cell') {
    const [row, column, columns] = await Promise.all([
      db.sheetRows.get(action.rowId),
      db.sheetColumns.get(action.columnId),
      db.sheetColumns.orderBy('position').toArray()
    ]);
    if (!row) return { ok: false, message: 'No encontré esa fila.' };
    if (!column) return { ok: false, message: 'No encontré esa columna.' };
    const values = { ...(row.values || {}) };
    if (action.type === 'clear_sheet_cell') delete values[column.key];
    else values[column.key] = coerceCellValue(column, action.value);
    await db.sheetRows.update(row.id, {
      values,
      ...financialPatch(columns, values),
      updatedAt: new Date().toISOString()
    });
    announce({ type: action.type, rowId: row.id, rowLabel: row.label, columnId: column.id, columnName: column.name });
    return {
      ok: true,
      message: action.type === 'clear_sheet_cell'
        ? `Listo, limpié ${column.name}.`
        : `Listo, actualicé ${column.name}.`
    };
  }

  if (action.type === 'delete_sheet_row') {
    const row = await db.sheetRows.get(action.rowId);
    if (!row) return { ok: false, message: 'No encontré esa fila.' };
    await db.transaction('rw', [db.sheetRows, db.sheetPhotos], async () => {
      await db.sheetPhotos.where('rowId').equals(row.id).delete();
      await db.sheetRows.delete(row.id);
    });
    announce({ type: action.type, rowId: row.id, rowLabel: row.label });
    return { ok: true, message: `Listo, eliminé ${row.label || 'esa fila'}.` };
  }

  return { ok: false, message: 'No pude ejecutar esa acción de Excel.' };
}
