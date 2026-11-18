import type { SheetColumn, SheetValue } from '../../shared/types';

/** Common bounded sheet representation for Noah voice and visual review. No writes. */
export function hasCellValue(value: SheetValue | undefined) {
  return value !== undefined && value !== null && value !== '';
}

export function columnSnapshot(columns: SheetColumn[]) {
  return columns.slice(0, 80).map((column) => ({
    id: column.id,
    name: column.name,
    key: column.key,
    type: column.type,
    behavior: column.behavior || 'neutral',
    position: column.position
  }));
}

