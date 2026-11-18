import type { SheetColumn, SheetColumnBehavior } from '../../shared/types';
export { normalizeText as normalizeSheetText } from '../../shared/normalizeText.ts';

/** The only text/amount/column-behavior helpers shared by Excel and Noah. */
/** Preserve existing Excel parsing exactly; this is NOT currency conversion. */
export function numberValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Neutral is the persisted legacy fallback, not a financial classification guess. */
export function behaviorOf(column: Pick<SheetColumn, 'behavior'>): SheetColumnBehavior {
  return column.behavior || 'neutral';
}
