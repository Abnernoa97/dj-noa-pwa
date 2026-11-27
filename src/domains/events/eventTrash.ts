import { db } from '../../services/storage/db';
import type { EventItem } from '../../shared/types';

/** Calendar trash never deletes linked Excel rows, reminders or photographs.
 * The same DJ NOA events table remains the source of truth, with no new DB.
 */
export function createCalendarTrash(store: Pick<typeof db,'events' | 'transaction'>) {
  const moveToTrash = async (ids: string[]) => {
    const unique = [...new Set(ids)];
    if (!unique.length) return 0;
    return store.transaction('rw', store.events, async () => {
      let count = 0;
      const now = new Date().toISOString();
      for (const id of unique) {
        const record = await store.events.get(id) as EventItem | undefined;
        if (!record || record.trashedAt) continue;
        await store.events.update(id, {trashedAt:now,updatedAt:now});
        count++;
      }
      return count;
    });
  };
  const restoreFromTrash = async (id: string) => {
    return store.transaction('rw', store.events, async () => {
      const record = await store.events.get(id) as EventItem | undefined;
      if (!record?.trashedAt) return false;
      await store.events.update(id, {trashedAt:undefined,updatedAt:new Date().toISOString()});
      return true;
    });
  };
  return {moveToTrash,restoreFromTrash};
}

export const {moveToTrash,restoreFromTrash} = createCalendarTrash(db);
