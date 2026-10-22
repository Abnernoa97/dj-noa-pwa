import type { SheetRow } from './types';

/** USD is the sole operational currency. Historical records are preserved verbatim. */
export function isUsdRow(row: Pick<SheetRow, 'currency'>): boolean {
  return row.currency === 'USD';
}

export function legacyFinancialRowCount(rows: Pick<SheetRow, 'currency' | 'amount'>[]): number {
  return rows.filter((row) => !isUsdRow(row) && Number(row.amount) !== 0).length;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export type UsdSettlement = {
  contracted: number | null;
  received: number;
  pending: number | null;
  hasContract: boolean;
  ambiguous: boolean;
  excludedLegacy: number;
};

function financialRole(row: SheetRow): 'fee' | 'deposit' | 'payment' | 'other' {
  if (row.financialRole) return row.financialRole;
  const label = normalize(row.label + ' ' + row.category);
  if (/\b(anticipo|deposito|deposit|advance)\b/.test(label)) return 'deposit';
  if (/\b(pago|payment|abono)\b/.test(label) && row.syncManaged !== true) return 'payment';
  if (row.financialType === 'income' && row.syncManaged === true && row.amount > 0) return 'fee';
  return 'other';
}

/**
 * Contract price is NOT a cash receipt. An advance is NOT additional contracted
 * revenue. No guesswork about multiple fee records or historical currencies.
 */
export function eventUsdSettlement(rows: SheetRow[]): UsdSettlement {
  const current = rows.filter(isUsdRow);
  const fees = current.filter((row) =>
    row.financialType === 'income' && row.amount > 0 && financialRole(row) === 'fee'
  );
  const ambiguous = fees.length > 1;
  const fee = fees.length === 1 ? fees[0] : undefined;
  const payments = current.filter((row) =>
    row.financialType === 'income' && row.status === 'paid' &&
    (financialRole(row) === 'deposit' || financialRole(row) === 'payment')
  );
  const paymentTotal = payments.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
  // If the fee itself was marked fully paid, it represents full settlement;
  // never add advance/payment rows on top of the same full fee.
  const received = fee?.status === 'paid' ? Math.max(fee.amount, paymentTotal) : paymentTotal;
  const contracted = fee ? fee.amount : null;
  return {
    contracted,
    received,
    pending: contracted === null ? null : Math.max(0, contracted - received),
    hasContract: Boolean(fee),
    ambiguous,
    excludedLegacy: legacyFinancialRowCount(rows)
  };
}

export function portfolioUsdSettlement(rows: SheetRow[]): UsdSettlement {
  const withEvent = new Map<string, SheetRow[]>();
  for (const row of rows.filter(isUsdRow)) {
    if (!row.eventId) continue;
    const items = withEvent.get(row.eventId) || [];
    items.push(row);
    withEvent.set(row.eventId, items);
  }
  let contracted = 0, received = 0, pending = 0, ambiguous = false, contractedEvents = 0;
  for (const eventRows of withEvent.values()) {
    const result = eventUsdSettlement(eventRows);
    if (result.ambiguous) { ambiguous = true; continue; }
    // A received advance remains a real receipt even if the fee was not yet
    // documented; only the contractual total/remaining balance stays unknown.
    received += result.received;
    if (result.contracted !== null) {
      contracted += result.contracted;
      pending += result.pending || 0;
      contractedEvents += 1;
    }
  }
  return {
    contracted: ambiguous || contractedEvents === 0 ? null : contracted,
    received,
    pending: ambiguous || contractedEvents === 0 ? null : pending,
    hasContract: contractedEvents > 0,
    ambiguous,
    excludedLegacy: legacyFinancialRowCount(rows)
  };
}
