/** Canonical accent-insensitive key for financial labels, photo reconciliation and Excel search.
 * This preserves the original ASCII-only normalization semantics; NOT a locale-aware display formatter. */
export function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
