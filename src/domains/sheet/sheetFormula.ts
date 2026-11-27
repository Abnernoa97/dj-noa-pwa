import { numberValue } from './sheetValues.ts';
import type { SheetColumn, SheetRow } from '../../shared/types';

/** Single formula evaluator for custom columns.
 * Arithmetic is isolated from React and IndexedDB; variable names are actual
 * stored column keys, and the historical division-by-zero policy remains 0.
 */
export function parseFormula(expression: string, vars: Record<string, number>): number | null {
  let source = expression.trim().replace(/^=/, '');
  source = source.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => String(vars[name] ?? 0));
  if (!source || /[^0-9+\-*/().\s]/.test(source)) return null;
  let i = 0;
  const skip = () => { while (/\s/.test(source[i] || '')) i += 1; };
  const readNumber = (): number => {
    skip();
    if (source[i] === '(') {
      i += 1;
      const value = readExpr();
      skip();
      if (source[i] !== ')') throw new Error('paren');
      i += 1;
      return value;
    }
    const start = i;
    if (source[i] === '+' || source[i] === '-') i += 1;
    while (/[0-9.]/.test(source[i] || '')) i += 1;
    const value = Number(source.slice(start, i));
    if (!Number.isFinite(value)) throw new Error('number');
    return value;
  };
  const readTerm = (): number => {
    let value = readNumber();
    while (true) {
      skip();
      const op = source[i];
      if (op !== '*' && op !== '/') break;
      i += 1;
      const next = readNumber();
      value = op === '*' ? value * next : next === 0 ? 0 : value / next;
    }
    return value;
  };
  const readExpr = (): number => {
    let value = readTerm();
    while (true) {
      skip();
      const op = source[i];
      if (op !== '+' && op !== '-') break;
      i += 1;
      const next = readTerm();
      value = op === '+' ? value + next : value - next;
    }
    return value;
  };
  try {
    const value = readExpr();
    skip();
    return i === source.length && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function formulaValue(column: SheetColumn, row: SheetRow, columns: SheetColumn[]) {
  if (column.type !== 'formula' || !column.formula) return row.values?.[column.key] ?? '';
  const vars: Record<string, number> = { amount: numberValue(row.amount) };
  for (const item of columns) vars[item.key] = numberValue(row.values?.[item.key]);
  return parseFormula(column.formula, vars);
}

