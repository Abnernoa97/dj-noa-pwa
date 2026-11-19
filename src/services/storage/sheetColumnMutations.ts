import { db, uid } from './db.ts';
import { behaviorOf, normalizeSheetText, makeGridColumnKey } from '../../domains/sheet/sheetValues.ts';
import { sheetFinancialPatch } from '../../domains/sheet/sheetFinancial.ts';
import type { SheetColumn, SheetColumnBehavior } from '../../shared/types';

/** Only owner of deleting an Excel column AND its values from rows.
 * This transaction is used identically by both Excel interfaces and Noah.
 * For financial columns, only USD rows that actually held the removed cell
 * have their net amount and type recalculated. Manual rows and MXN amounts
 * are not silently reset. Neutral columns never recalculate money.
 */
export function createSheetColumnDeletion(store: Pick<typeof db, 'sheetColumns' | 'sheetRows' | 'transaction'>) {
  async function deleteSheetColumnAndValues(column: Pick<SheetColumn, 'id' | 'key' | 'behavior'>): Promise<void> {
    await store.transaction('rw', [store.sheetColumns, store.sheetRows], async () => {
      await store.sheetColumns.delete(column.id);
      const remaining = await store.sheetColumns.orderBy('position').toArray();
      const rows = await store.sheetRows.toArray();
      const financial = behaviorOf(column) !== 'neutral';
      const updatedAt = new Date().toISOString();
      for (const row of rows) {
        if (!Object.prototype.hasOwnProperty.call(row.values || {}, column.key)) continue;
        const values = { ...(row.values || {}) };
        delete values[column.key];
        const moneyPatch = financial && row.currency === 'USD'
          ? sheetFinancialPatch(remaining, values)
          : {};
        await store.sheetRows.update(row.id, { values, ...moneyPatch, updatedAt });
      }
    });
  }
  return { deleteSheetColumnAndValues };
}

export const { deleteSheetColumnAndValues } = createSheetColumnDeletion(db);

/** One grid column creator for manual Excel and Noah AI.
 * A single column transaction protects name uniqueness across concurrent creators.
 * Classic formula/text columns follow a different key contract and are not silently migrated.
 */
export function createGridColumnWriter(
  store: Pick<typeof db, 'sheetColumns' | 'transaction'>,
  newId: () => string = uid
) {
  async function createGridSheetColumn(name: string, behavior: SheetColumnBehavior): Promise<{column: SheetColumn; created: boolean}> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('empty_column_name');
    return store.transaction('rw', store.sheetColumns, async () => {
      const columns = await store.sheetColumns.orderBy('position').toArray();
      const duplicate = columns.find((column) => normalizeSheetText(column.name) === normalizeSheetText(trimmed));
      if (duplicate) return { column: duplicate, created: false };
      const column: SheetColumn = {
        id: newId(),
        name: trimmed,
        key: makeGridColumnKey(trimmed, newId()),
        type: behavior === 'neutral' ? 'text' : 'currency',
        behavior,
        position: columns.length ? Math.max(...columns.map((item) => item.position)) + 1 : 0,
        createdAt: new Date().toISOString()
      };
      await store.sheetColumns.add(column);
      return { column, created: true };
    });
  }
  return { createGridSheetColumn };
}

export const { createGridSheetColumn } = createGridColumnWriter(db);
