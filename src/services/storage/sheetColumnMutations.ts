import { db } from './db.ts';
import { behaviorOf } from '../../domains/sheet/sheetValues.ts';
import { sheetFinancialPatch } from '../../domains/sheet/sheetFinancial.ts';
import type { SheetColumn } from '../../shared/types';

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
