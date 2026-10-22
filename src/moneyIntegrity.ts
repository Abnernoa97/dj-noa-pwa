import type { CurrencyCode, SheetColumn, SheetRow, SheetStatus } from './types';

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

export function formatMoneyAmount(amount: number, currency: CurrencyCode = 'USD'): string {
  if (currency !== 'USD') return 'Importe histórico sin convertir';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(amount);
}

/** USD-only visible totals. MXN values remain in storage but NEVER become dollars. */
export function formatMoneyBuckets(totals: Record<CurrencyCode, number>): string {
  return formatMoneyAmount(totals.USD, 'USD') + ' USD';
}

export type ExcelFinancialTotals = {
  income: number;
  expense: number;
  investment: number;
  balance: number;
};

/** Shared calculation for the expanded Excel grid. Row currency applies to
 * all of its financial columns; neutral fields never contribute to totals.
 * The caller supplies the same effective cell values displayed in the grid.
 */
export function groupedExcelTotals(
  rows: SheetRow[],
  columns: SheetColumn[],
  readCell: (row: SheetRow, column: SheetColumn) => unknown
): Record<CurrencyCode, ExcelFinancialTotals> {
  const empty = (): ExcelFinancialTotals => ({ income: 0, expense: 0, investment: 0, balance: 0 });
  const totals: Record<CurrencyCode, ExcelFinancialTotals> = { MXN: empty(), USD: empty() };
  for (const row of rows) {
    const currency = row.currency === 'USD' ? 'USD' : 'MXN'; // pre-currency legacy rows are MXN
    for (const column of columns) {
      const kind = column.behavior || 'neutral';
      if (kind === 'neutral') continue;
      const raw = readCell(row, column);
      const amount = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[$,\s]/g, ''));
      if (!Number.isFinite(amount)) continue;
      totals[currency][kind] += amount;
    }
  }
  for (const currency of ['MXN', 'USD'] as const) {
    const t = totals[currency];
    t.balance = t.income - t.expense - t.investment;
  }
  return totals;
}

/** No implicit FX conversion, including when only one currency has a balance. */
export function formatMoneyTotals(
  rows: Pick<SheetRow, 'amount' | 'currency' | 'status'>[],
  statuses?: SheetStatus[]
): string {
  const selected = statuses ? rows.filter(row => statuses.includes(row.status)) : rows;
  const count = selected.filter(row => row.currency !== 'USD' && Number(row.amount) !== 0).length;
  return formatMoneyBuckets(groupedMoney(selected)) +
    (count ? ` · ${count} importe${count === 1 ? '' : 's'} histórico${count === 1 ? '' : 's'} excluido${count === 1 ? '' : 's'}` : '');
}
