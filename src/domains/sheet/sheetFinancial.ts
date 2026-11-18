import type { FinancialType, SheetColumn, SheetRow, SheetValue } from '../../shared/types';
import { behaviorOf, numberValue } from './sheetValues.ts';

/** One pure financial calculation shared by Noah and Excel grid. It does not write or convert currencies. */
export function sheetFinancialPatch(columns: SheetColumn[], values: Record<string, SheetValue>): Pick<SheetRow, 'amount' | 'financialType'> {
  let income = 0;
  let expense = 0;
  let investment = 0;

  for (const column of columns) {
    const behavior = behaviorOf(column);
    if (behavior === 'neutral') continue;
    const value = numberValue(values[column.key]);
    if (behavior === 'income') income += value;
    if (behavior === 'expense') expense += value;
    if (behavior === 'investment') investment += value;
  }

  const net = income - expense - investment;
  const financialType: FinancialType = net > 0 ? 'income' : net < 0 ? 'expense' : 'neutral';
  return { amount: Math.abs(net), financialType };
}

