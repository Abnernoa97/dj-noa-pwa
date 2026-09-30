import type { AssistantResponse, SheetRow } from './types';

type HistoryLike = {
  command?: string;
  result?: string;
  actionSummary?: string[];
};

type BulkDeleteContext = {
  sheetRows: SheetRow[];
};

const CONFIRMATION_TEXT = 'Voy a borrar todos los registros de Excel y sus fotos. Las columnas se conservarán. ¿Confirmas?';

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBroadSheetClearRequest(command: string) {
  const text = normalize(command);
  const patterns = [
    /^(?:por favor )?(?:quiero (?:que )?)?(?:borra(?:me|lo|los)?|borrar|borre(?:me|lo|los)?|borres|elimina(?:me|lo)?|eliminar|elimine(?:lo)?|vacia|vaciar|limpia|limpiar) (?:absolutamente )?todo(?: todo)?(?: lo)? (?:que hay )?(?:de |del |en |el )?(?:excel|la tabla|tabla|la hoja|hoja)(?: por completo| completamente| completo| completa| entero| entera)?(?: por favor)?$/,
    /^(?:por favor )?(?:quiero (?:que )?)?(?:borra(?:me)?|borrar|borre(?:me)?|borres|elimina(?:me)?|eliminar|elimine|vacia|vaciar|limpia|limpiar) tod(?:as|os) (?:las |los )?(?:filas|registros|movimientos|datos) (?:que hay )?(?:de |del |en )?(?:excel|la tabla|tabla|la hoja|hoja)(?: por completo| completamente)?(?: por favor)?$/,
    /^(?:por favor )?(?:quiero (?:que )?)?(?:vacia|vaciar|limpia|limpiar|borra|borre|borrar|elimina|elimine|eliminar) (?:por completo |completamente )?(?:todo )?(?:el |la )?(?:excel|tabla|hoja)(?: completo| completa| entero| entera| completamente| por completo)?(?: por favor)?$/,
    /^(?:por favor )?(?:quiero (?:que )?)?deja (?:el |la )?(?:excel|tabla|hoja) (?:vacio|vacia|en blanco|limpio|limpia)(?: por favor)?$/,
    /^(?:por favor )?(?:quita|quitar) todo(?: lo)? (?:que hay )?(?:de |del |en )?(?:excel|la tabla|tabla|la hoja|hoja)(?: por favor)?$/
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function isExplicitConfirmation(command: string) {
  const text = normalize(command);
  return /^(?:si )?(?:confirmo|confirmado|estoy seguro|estoy segura|hazlo|adelante|borralo todo|borra todo|borre todo|eliminalo todo|elimina todo)$/.test(text)
    || /\b(?:confirmo|estoy seguro|estoy segura)\b/.test(text);
}

function isShortConfirmation(command: string) {
  return /^(?:si|confirmo|confirmado|adelante|hazlo|de acuerdo|ok|okay|correcto)$/i.test(normalize(command));
}

function resultLooksLikePendingBulkDelete(result: string) {
  const text = normalize(result);
  if (!text.includes('excel') && !text.includes('tabla') && !text.includes('hoja')) return false;
  return [
    'voy a borrar todos los registros',
    'borrar todo lo que hay',
    'borrar todos los registros',
    'procedere a borrar todos',
    'eliminar todos los registros',
    'dejar excel vacio',
    'dejar la tabla vacia'
  ].some((fragment) => text.includes(fragment));
}

function hasPendingBulkDelete(history: HistoryLike[]) {
  const recent = history.slice(-4);
  if (recent.some((item) => (item.actionSummary || []).some((summary) => summary.startsWith('clear_sheet_rows')))) return false;
  return recent.some((item) => item.result && resultLooksLikePendingBulkDelete(item.result));
}

export function resolveBulkSheetDelete(
  command: string,
  context: BulkDeleteContext,
  recentHistory: HistoryLike[] = []
): AssistantResponse | null {
  if (hasPendingBulkDelete(recentHistory) && isShortConfirmation(command)) {
    if (!context.sheetRows.length) return { reply: 'Excel ya está vacío.', actions: [{ type: 'none' }] };
    return {
      reply: 'Borrando todos los registros de Excel ahora.',
      actions: [{ type: 'clear_sheet_rows' }]
    };
  }

  if (!isBroadSheetClearRequest(command)) return null;
  if (!context.sheetRows.length) return { reply: 'Excel ya está vacío.', actions: [{ type: 'none' }] };

  if (isExplicitConfirmation(command)) {
    return {
      reply: 'Borrando todos los registros de Excel ahora.',
      actions: [{ type: 'clear_sheet_rows' }]
    };
  }

  return {
    reply: CONFIRMATION_TEXT,
    actions: [{ type: 'none' }]
  };
}
