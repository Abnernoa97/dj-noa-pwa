import { db } from './db.ts';

/** The only owner of Excel row + photo deletion.
 * Store injection allows unit testing without opening the user's IndexedDB.
 */
export function createSheetRowDeletion(store: Pick<typeof db, 'sheetRows' | 'sheetPhotos' | 'transaction'>) {
  async function deleteRowsAndPhotos(rowIds: readonly string[], single: boolean): Promise<void> {
    if (!rowIds.length) return;
    await store.transaction('rw', [store.sheetRows, store.sheetPhotos], async () => {
      for (const rowId of rowIds) {
        await store.sheetPhotos.where('rowId').equals(rowId).delete();
      }
      if (single) await store.sheetRows.delete(rowIds[0]);
      else await store.sheetRows.bulkDelete([...rowIds]);
    });
  }

  async function deleteSheetRowWithPhotos(rowId: string): Promise<void> {
    await deleteRowsAndPhotos([rowId], true);
  }

  async function deleteSheetRowsWithPhotos(rowIds: readonly string[]): Promise<void> {
    await deleteRowsAndPhotos(rowIds, false);
  }

  return { deleteSheetRowWithPhotos, deleteSheetRowsWithPhotos };
}

export const { deleteSheetRowWithPhotos, deleteSheetRowsWithPhotos } = createSheetRowDeletion(db);
