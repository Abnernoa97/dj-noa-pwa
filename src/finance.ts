import type { CurrencyCode, FinancialType, SheetRow } from './types';

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const INCOME_WORDS = ['ganancia', 'ingreso', 'retribucion', 'cobro', 'venta', 'anticipo', 'deposito', 'honorario', 'comision'];
const EXPENSE_WORDS = ['inversion', 'gasto', 'costo', 'pago', 'compra', 'proveedor', 'transporte', 'audio', 'produccion', 'publicidad'];

export function financialTypeForCategory(category: string): FinancialType {
  const value = normalize(category);
  if (INCOME_WORDS.some((word) => value.includes(word))) return 'income';
  if (EXPENSE_WORDS.some((word) => value.includes(word))) return 'expense';
  return 'neutral';
}

export function rowFinancialType(row: Pick<SheetRow, 'category' | 'financialType'>): FinancialType {
  return row.financialType || financialTypeForCategory(row.category);
}

/** Per-currency finance summary; never return a mixed-unit balance. */
export function financialSummary(rows: SheetRow[]): Record<CurrencyCode, {
  income: number; expense: number; neutral: number; balance: number
}> {
  const blank = () => ({ income: 0, expense: 0, neutral: 0, balance: 0 });
  const totals = { MXN: blank(), USD: blank() };
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    if (!Number.isFinite(amount)) continue;
    const currency = row.currency === 'USD' ? 'USD' : 'MXN';
    const type = rowFinancialType(row);
    totals[currency][type] += amount;
  }
  for (const currency of ['MXN', 'USD'] as const) {
    totals[currency].balance = totals[currency].income - totals[currency].expense;
  }
  return totals;
}

export function financialTypeLabel(type: FinancialType) {
  if (type === 'income') return 'Ingreso';
  if (type === 'expense') return 'Gasto';
  return 'Neutro';
}
