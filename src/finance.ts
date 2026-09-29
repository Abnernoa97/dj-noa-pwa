import type { FinancialType, SheetRow } from './types';

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

export function financialSummary(rows: SheetRow[]) {
  let income = 0;
  let expense = 0;
  let neutral = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    const type = rowFinancialType(row);
    if (type === 'income') income += amount;
    else if (type === 'expense') expense += amount;
    else neutral += amount;
  }
  return { income, expense, neutral, balance: income - expense };
}

export function financialTypeLabel(type: FinancialType) {
  if (type === 'income') return 'Ingreso';
  if (type === 'expense') return 'Gasto';
  return 'Neutro';
}
