import { db } from './db.ts';

/** Sole owner of manual sheet-row deletion.
 * Always delete attachments and rows in the same Dexie transaction.
 * Single deletion preserves original Table.delete; selection preserves bulkDelete.
 */
async function deleteRowsAndPhotos(rowIds: readonly string[], single: boolean): Promise<void> {
  if (!rowIds.length) return;
  await db.transaction('rw', [db.sheetRows, db.sheetPhotos], async () => {
    for (const rowId of rowIds) {
      await db.sheetPhotos.where('rowId').equals(rowId).delete();
    }
    if (single) await db.sheetRows.delete(rowIds[0]);
    else await db.sheetRows.bulkDelete([...rowIds]);
  });
}

export async function deleteSheetRowWithPhotos(rowId: string): Promise<void> {
  await deleteRowsAndPhotos([rowId], true);
}

export async function deleteSheetRowsWithPhotos(rowIds: readonly string[]): Promise<void> {
  await deleteRowsAndPhotos(rowIds, false);
}
