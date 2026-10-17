import { db, uid } from './db';
import { createEventWithRelations } from './eventMutations';
import { isValidEventDate, normalizedEventIdentity } from './eventIntegrity';
import { assertNoahVisionStorageCapacity } from './noahStorageBudget';
import type { ReviewAction } from './noahImageReconcile';
import type { EventPhoto, SheetPhoto, SheetRow } from './types';

export type VisionSource = { sourceId: string; file: File; rawText: string };
type PreparedSource = VisionSource & { hash: string };

function validateSourceIds(proposals: ReviewAction[], sources: VisionSource[]): Set<string> {
  const ids = new Set<string>();
  for (const source of sources) {
    if (!source.sourceId || ids.has(source.sourceId) || !/^image\/(jpeg|png|webp)$/i.test(source.file.type) ||
        source.file.size < 1 || source.file.size > 16 * 1024 * 1024) throw new Error('invalid_vision_source');
    ids.add(source.sourceId);
  }
  for (const proposal of proposals) {
    if (!proposal.sources.length || proposal.sources.some((id) => !ids.has(id)) ||
        proposal.financeSources?.some((id) => !ids.has(id))) throw new Error('missing_vision_evidence');
    if (proposal.action.type !== 'create_event' && proposal.action.type !== 'create_sheet_row') {
      throw new Error('unsupported_vision_action');
    }
  }
  return new Set(proposals.flatMap((proposal) => [...proposal.sources, ...(proposal.financeSources || [])]));
}

async function hashSource(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Keep all writes within one IndexedDB transaction. File hashing is completed
 * before the transaction starts, so transactions never wait for crypto/network.
 * Failure of any event, Excel row or photo rolls back the entire image import.
 */
export async function commitNoahVision(
  proposals: ReviewAction[],
  sources: VisionSource[]
): Promise<{ eventCount: number; movementCount: number; eventPhotoCount: number; paymentPhotoCount: number }> {
  if (!proposals.length || proposals.length > 100) throw new Error('invalid_vision_batch');
  const usedSourceIds = validateSourceIds(proposals, sources);
  const sizes = new Map(sources.map((source) => [source.sourceId, source.file.size]));
  const estimatedBytes = proposals.reduce((sum, proposal) => {
    const ids = [...proposal.sources, ...(proposal.action.type === 'create_event' ? proposal.financeSources || [] : [])];
    return sum + ids.reduce((subtotal, id) => subtotal + (sizes.get(id) || 0), 0);
  }, 0);
  // Browser quota estimates are advisory; the IndexedDB transaction still
  // provides the final all-or-nothing protection if a write runs out of space.
  await assertNoahVisionStorageCapacity(estimatedBytes);
  const prepared: PreparedSource[] = [];
  for (const source of sources) {
    if (!usedSourceIds.has(source.sourceId)) continue;
    prepared.push({ ...source, hash: await hashSource(source.file) });
  }
  const byId = new Map(prepared.map((s) => [s.sourceId, s]));
  const creationKeys = new Set<string>();
  for (const { action } of proposals) {
    if (action.type === 'create_event') {
      if (!isValidEventDate(action.event.date) || !action.event.title.trim()) throw new Error('invalid_event_identity');
      const key = normalizedEventIdentity(action.event.title, action.event.date);
      if (creationKeys.has(key)) throw new Error('duplicate_vision_event');
      creationKeys.add(key);
    } else if (action.type === 'create_sheet_row') {
      const row = action.row;
      if (!row.eventTitle?.trim() || !isValidEventDate(row.eventDateISO || '') ||
          !isValidEventDate(row.calendarDate || '') || row.currency !== 'MXN' && row.currency !== 'USD' ||
          !Number.isFinite(row.amount) || row.amount <= 0) throw new Error('ambiguous_vision_payment');
    }
  }

  return db.transaction('rw', [db.events, db.sheetRows, db.eventPhotos, db.sheetPhotos], async () => {
    const existing = await db.events.toArray();
    const eventByKey = new Map(existing.map((event) => [normalizedEventIdentity(event.title, event.date), event]));
    for (const key of creationKeys) if (eventByKey.has(key)) throw new Error('duplicate_vision_event');

    const now = new Date().toISOString();
    let eventCount = 0, movementCount = 0, eventPhotoCount = 0, paymentPhotoCount = 0;
    const eventPhotos: EventPhoto[] = [];
    const sheetPhotos: SheetPhoto[] = [];
    const existingPhotoHashes = new Map<string, Set<string>>();
    const sheetPhotoHashes = new Map<string, Set<string>>();
    const addSheetEvidence = (rowId: string, source: PreparedSource) => {
      let hashes = sheetPhotoHashes.get(rowId);
      if (!hashes) {
        hashes = new Set<string>();
        sheetPhotoHashes.set(rowId, hashes);
      }
      if (hashes.has(source.hash)) return;
      hashes.add(source.hash);
      sheetPhotos.push({
        id: uid(), rowId, name: source.file.name, type: source.file.type,
        blob: source.file, createdAt: now, sourceKind: 'noah-vision',
        sourceHash: source.hash, sourceEvidence: source.rawText.slice(0, 12000)
      });
    };

    const ensureNoDuplicatePhotos = async (eventId: string) => {
      if (!existingPhotoHashes.has(eventId)) {
        const photos = await db.eventPhotos.where('eventId').equals(eventId).toArray();
        existingPhotoHashes.set(eventId, new Set(photos.map((p) => p.sourceHash).filter((hash): hash is string => Boolean(hash))));
      }
      return existingPhotoHashes.get(eventId)!;
    };

    // Create event(s) first, then separately dated payments may reference them.
    for (const { action, sources: sourceIds, financeSources } of proposals) {
      if (action.type !== 'create_event') continue;
      const { event, row, skipped } = await createEventWithRelations({
        ...action.event,
        time: action.event.showTime || action.event.time || '',
        showTime: action.event.showTime || action.event.time || '',
        status: action.event.status || 'confirmed'
      }, { finance: action.finance, createExcelConcept: true, skipDuplicates: true });
      if (!event || skipped) throw new Error('duplicate_vision_event');
      eventByKey.set(normalizedEventIdentity(event.title, event.date), event);
      eventCount++;
      const stored = await ensureNoDuplicatePhotos(event.id);
      for (const sourceId of sourceIds) {
        const source = byId.get(sourceId)!;
        if (stored.has(source.hash)) continue;
        stored.add(source.hash);
        eventPhotos.push({
          id: uid(), eventId: event.id, name: source.file.name, type: source.file.type,
          blob: source.file, createdAt: now,
          sourceKind: 'noah-vision', sourceHash: source.hash,
          sourceEvidence: source.rawText.slice(0, 12000)
        });
      }
      if (row && action.finance && financeSources?.length) {
        for (const sourceId of financeSources) {
          const source = byId.get(sourceId);
          if (!source) throw new Error('missing_finance_evidence');
          addSheetEvidence(row.id, source);
        }
      }
    }

    const paymentKeys = new Set<string>();
    for (const { action, sources: sourceIds } of proposals) {
      if (action.type !== 'create_sheet_row') continue;
      const proposal = action.row;
      const eventKey = normalizedEventIdentity(proposal.eventTitle!, proposal.eventDateISO!);
      const event = eventByKey.get(eventKey);
      // Never attach money to a guessed event, including an imported one.
      if (!event) throw new Error('vision_payment_event_not_found');
      const label = (proposal.label || 'Anticipo').trim();
      const key = [event.id, label.toLowerCase(), proposal.calendarDate, proposal.amount, proposal.currency].join('|');
      if (paymentKeys.has(key)) throw new Error('duplicate_vision_payment');
      const previous = await db.sheetRows.where('eventId').equals(event.id).toArray();
      if (previous.some((row) => [event.id, row.label.toLowerCase(), row.calendarDate, row.amount, row.currency].join('|') === key)) {
        throw new Error('duplicate_vision_payment');
      }
      paymentKeys.add(key);
      const movement: SheetRow = {
        id: uid(), label, category: proposal.category || 'Anticipo',
        amount: proposal.amount, currency: proposal.currency,
        status: proposal.status || 'pending', financialType: 'income',
        eventId: event.id, calendarDate: proposal.calendarDate,
        calendarDateSource: 'manual', syncManaged: false,
        notes: proposal.notes, description: proposal.description,
        values: {}, createdAt: now, updatedAt: now
      };
      await db.sheetRows.add(movement);
      movementCount++;
      for (const sourceId of sourceIds) {
        const source = byId.get(sourceId)!;
        addSheetEvidence(movement.id, source);
      }
    }

    if (eventPhotos.length) await db.eventPhotos.bulkAdd(eventPhotos);
    if (sheetPhotos.length) await db.sheetPhotos.bulkAdd(sheetPhotos);
    eventPhotoCount = eventPhotos.length;
    paymentPhotoCount = sheetPhotos.length;
    return { eventCount, movementCount, eventPhotoCount, paymentPhotoCount };
  });
}
