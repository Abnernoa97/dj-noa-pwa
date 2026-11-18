import type { SheetColumn, SheetColumnBehavior } from '../../types';

/** The only text/amount/column-behavior helpers shared by Excel and Noah. */
export function normalizeSheetText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

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
