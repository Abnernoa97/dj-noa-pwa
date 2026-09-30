import type { AssistantAction, AssistantResponse, EventItem, ReminderItem, SheetRow } from './types';

export type AssistantTotalsContext = {
  events: EventItem[];
  reminders: ReminderItem[];
  sheetRows: SheetRow[];
};

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function resolvePureTotal(response: AssistantResponse, context: AssistantTotalsContext): AssistantResponse {
  const queries = response.actions.filter((action): action is Extract<AssistantAction, { type: 'query_total' }> => action.type === 'query_total');
  if (!queries.length) return response;

  const hasMutation = response.actions.some((action) => [
    'create_event', 'update_event', 'delete_event',
    'create_reminder', 'update_reminder', 'delete_reminder',
    'add_sheet_row', 'update_sheet_row', 'delete_sheet_row', 'add_sheet_column'
  ].includes(action.type));
  if (hasMutation) return response;

  const query = queries[queries.length - 1];
  const category = query.category ? normalize(query.category) : '';
  const rows = context.sheetRows.filter((row) => {
    if (category && normalize(row.category) !== category) return false;
    if (query.status && row.status !== query.status) return false;
    return true;
  });

  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0
  }).format(total);
  const filters = [
    query.category,
    query.status === 'paid' ? 'pagado' : query.status === 'pending' ? 'pendiente' : query.status === 'info' ? 'info' : ''
  ].filter(Boolean).join(' · ');
  const reply = `${filters ? `${filters}: ` : 'Total: '}${formatted} en ${rows.length} ${rows.length === 1 ? 'movimiento' : 'movimientos'}.`;

  return {
    reply,
    actions: response.actions.filter((action) => action.type !== 'query_total')
  };
}
