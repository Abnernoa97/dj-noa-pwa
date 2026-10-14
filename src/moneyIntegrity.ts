import type { CurrencyCode, SheetRow, SheetStatus } from './types';

export function groupedMoney(
  rows: Pick<SheetRow, 'amount' | 'currency' | 'status'>[],
  statuses?: SheetStatus[]
): Record<CurrencyCode, number> {
  const result: Record<CurrencyCode, number> = { MXN: 0, USD: 0 };
  for (const row of rows) {
    if (statuses && !statuses.includes(row.status)) continue;
    const currency = row.currency === 'USD' ? 'USD' : 'MXN';
    const amount = Number(row.amount);
    if (Number.isFinite(amount)) result[currency] += amount;
  }
  return result;
}

export function formatMoneyAmount(amount: number, currency: CurrencyCode = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(amount);
}

/** No implicit currency conversion. Mixed currencies are displayed separately. */
export function formatMoneyTotals(
  rows: Pick<SheetRow, 'amount' | 'currency' | 'status'>[],
  statuses?: SheetStatus[]
): string {
  const { MXN, USD } = groupedMoney(rows, statuses);
  if (USD === 0) return formatMoneyAmount(MXN, 'MXN');
  if (MXN === 0) return formatMoneyAmount(USD, 'USD');
  return `${formatMoneyAmount(MXN, 'MXN')} · ${formatMoneyAmount(USD, 'USD')}`;
}
