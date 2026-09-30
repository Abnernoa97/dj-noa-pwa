import type { AssistantResponse, SheetRow } from './types';

type HistoryLike = {
  command?: string;
  result?: string;
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
    .trim();
}

function isBroadSheetClearRequest(command: string) {
  const text = normalize(command);
  const patterns = [
    /^(?:por favor )?(?:borra(?:me|los)?|borrar|elimina(?:me)?|eliminar|vacia|vaciar|limpia|limpiar|borranse) (?:absolutamente )?todo(?: lo)? (?:de |del |en |el )?(?:excel|la tabla|tabla|la hoja|hoja)(?: por completo| completamente| completo| completa| entero| entera)?(?: por favor)?$/,
    /^(?:por favor )?(?:borra(?:me)?|borrar|elimina(?:me)?|eliminar) tod(?:as|os) (?:las |los )?(?:filas|registros|movimientos|datos) (?:de |del )?(?:excel|la tabla|tabla|la hoja|hoja)(?: por favor)?$/,
    /^(?:por favor )?(?:vacia|vaciar|limpia|limpiar) (?:por completo )?(?:todo )?(?:el |la )?(?:excel|tabla|hoja)(?: completamente| por completo)?(?: por favor)?$/,
    /^(?:por favor )?deja (?:el |la )?(?:excel|tabla|hoja) (?:vacio|vacia|en blanco|limpio|limpia)(?: por favor)?$/
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function isExplicitConfirmation(command: string) {
  const text = normalize(command);
  return /^(?:si )?(?:confirmo|confirmado|estoy seguro|estoy segura|hazlo|adelante|borralo todo|borra todo|eliminalo todo|elimina todo)$/.test(text)
    || /\b(?:confirmo|estoy seguro|estoy segura)\b/.test(text);
}

function isShortConfirmation(command: string) {
  return /^(?:si|confirmo|confirmado|adelante|hazlo|de acuerdo|ok|okay|correcto)$/i.test(normalize(command));
}

function hasPendingBulkDelete(history: HistoryLike[]) {
  const last = history[history.length - 1];
  if (!last?.result) return false;
  return normalize(last.result).includes('voy a borrar todos los registros de excel y sus fotos');
}

export function resolveBulkSheetDelete(
  command: string,
  context: BulkDeleteContext,
  recentHistory: HistoryLike[] = []
): AssistantResponse | null {
  if (hasPendingBulkDelete(recentHistory) && isShortConfirmation(command)) {
    if (!context.sheetRows.length) return { reply: 'Excel ya está vacío.', actions: [{ type: 'none' }] };
    return {
      reply: 'Voy a dejar Excel vacío ahora.',
      actions: [{ type: 'clear_sheet_rows' }]
    };
  }

  if (!isBroadSheetClearRequest(command)) return null;
  if (!context.sheetRows.length) return { reply: 'Excel ya está vacío.', actions: [{ type: 'none' }] };

  if (isExplicitConfirmation(command)) {
    return {
      reply: 'Voy a dejar Excel vacío ahora.',
      actions: [{ type: 'clear_sheet_rows' }]
    };
  }

  return {
    reply: CONFIRMATION_TEXT,
    actions: [{ type: 'none' }]
  };
}
