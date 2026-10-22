import { db, uid } from './db';
import { createEventWithRelations } from './eventMutations';
import { isValidEventDate, normalizedEventIdentity } from './eventIntegrity';
import type { ReviewAction } from './noahImageReconcile';
import type { SheetRow } from './types';

/** Images are transient inputs for recognition, not permanent attachments. */
export type VisionSource = { sourceId: string; file: File; rawText: string };

function validateVisionSources(proposals: ReviewAction[], sources: VisionSource[]): void {
  if (!sources.length || sources.length > 5) throw new Error('invalid_vision_sources');
  const sourceIds = new Set<string>();
  for (const source of sources) {
    if (!source.sourceId || sourceIds.has(source.sourceId) ||
        !/^image\/(jpeg|png|webp)$/i.test(source.file.type) ||
        source.file.size < 1 || source.file.size > 16 * 1024 * 1024) {
      throw new Error('invalid_vision_source');
    }
    sourceIds.add(source.sourceId);
  }
  for (const proposal of proposals) {
    if (!proposal.sources.length ||
        [...proposal.sources, ...(proposal.financeSources || [])].some((id) => !sourceIds.has(id))) {
      throw new Error('missing_vision_evidence');
    }
    if (proposal.action.type !== 'create_event' && proposal.action.type !== 'create_sheet_row') {
      throw new Error('unsupported_vision_action');
    }
  }
}

/**
 * Save only confirmed structured values. Source files remain in the intake
 * component temporarily for review, then are released; they are never
 * written to eventPhotos, sheetPhotos, or any new database table.
 *
 * Event + Excel writes still share one atomic IndexedDB transaction.
 */
export async function commitNoahVision(
  proposals: ReviewAction[],
  sources: VisionSource[]
): Promise<{ eventCount: number; movementCount: number; eventPhotoCount: number; paymentPhotoCount: number }> {
  if (!proposals.length || proposals.length > 100) throw new Error('invalid_vision_batch');
  validateVisionSources(proposals, sources);

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
          !isValidEventDate(row.calendarDate || '') ||
          row.currency !== 'USD' ||
          !Number.isFinite(row.amount) || row.amount <= 0) {
        throw new Error('ambiguous_vision_payment');
      }
    }
  }

  return db.transaction('rw', [db.events, db.sheetRows], async () => {
    const existing = await db.events.toArray();
    const eventByKey = new Map(existing.map((event) => [normalizedEventIdentity(event.title, event.date), event]));
    for (const key of creationKeys) if (eventByKey.has(key)) throw new Error('duplicate_vision_event');

    const now = new Date().toISOString();
    let eventCount = 0, movementCount = 0;

    // Events are committed first so independent payment dates can link to them.
    for (const { action } of proposals) {
      if (action.type !== 'create_event') continue;
      const { event, skipped } = await createEventWithRelations({
        ...action.event,
        time: action.event.showTime || action.event.time || '',
        showTime: action.event.showTime || action.event.time || '',
        status: action.event.status || 'confirmed'
      }, { finance: action.finance, createExcelConcept: true, skipDuplicates: true });
      if (!event || skipped) throw new Error('duplicate_vision_event');
      eventByKey.set(normalizedEventIdentity(event.title, event.date), event);
      eventCount++;
    }

    const paymentKeys = new Set<string>();
    for (const { action } of proposals) {
      if (action.type !== 'create_sheet_row') continue;
      const proposal = action.row;
      const eventKey = normalizedEventIdentity(proposal.eventTitle!, proposal.eventDateISO!);
      const event = eventByKey.get(eventKey);
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
        financialRole: (label === 'Anticipo' ? 'deposit' : 'payment'),
        eventId: event.id, calendarDate: proposal.calendarDate,
        calendarDateSource: 'manual', syncManaged: false,
        notes: proposal.notes, description: proposal.description,
        values: {}, createdAt: now, updatedAt: now
      };
      await db.sheetRows.add(movement);
      movementCount++;
    }

    return { eventCount, movementCount, eventPhotoCount: 0, paymentPhotoCount: 0 };
  });
}
