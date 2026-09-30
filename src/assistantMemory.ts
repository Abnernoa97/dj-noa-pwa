import { askAssistant } from './assistant';
import { previewAssistantResponse } from './AssistantPlanPreview';
import { resolvePureTotal } from './assistantTotals';
import { db } from './db';
import type { AssistantResponse, AppView, EventItem, ReminderItem, SheetRow } from './types';

export type AssistantMemoryItem = {
  command: string;
  result: string;
  actionSummary?: string[];
  undoneAt?: string;
  kind?: 'command' | 'undo';
};

export type AssistantUiContext = {
  view: AppView;
  activeEventId?: string;
  activeEventTitle?: string;
  activeEventDate?: string;
  activeEventVenue?: string;
};

type Context = {
  events: EventItem[];
  reminders: ReminderItem[];
  sheetRows: SheetRow[];
};

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const STOP_WORDS = new Set(['para', 'como', 'este', 'esta', 'esto', 'aqui', 'alla', 'quiero', 'puedes', 'ponle', 'agrega', 'cambia', 'corrige', 'hacer', 'hazme', 'dime', 'todo', 'todos', 'todas', 'solo', 'nada', 'mejor', 'ahora']);

function commandWords(command: string) {
  return [...new Set(normalize(command).split(' ').filter((word) => word.length >= 4 && !STOP_WORDS.has(word)))];
}

function recentEntityIds(items: AssistantMemoryItem[]) {
  const ids = new Set<string>();
  for (const item of items.slice(-6)) {
    for (const summary of item.actionSummary || []) {
      for (const match of summary.matchAll(/(?:^|\s)(?:id|eventId)=([^\s]+)/g)) ids.add(match[1]);
    }
  }
  return ids;
}

function scoreText(text: string, words: string[]) {
  const haystack = normalize(text);
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

function focusedContext(command: string, context: Context, history: AssistantMemoryItem[], uiContext: AssistantUiContext | undefined, activeSheetRowId?: string) {
  const words = commandWords(command);
  const recentIds = recentEntityIds(history);
  const activeEventId = uiContext?.activeEventId;

  const events = [...context.events]
    .map((item) => ({ item, score: (item.id === activeEventId ? 100 : 0) + (recentIds.has(item.id) ? 60 : 0) + scoreText(`${item.title} ${item.venue || ''} ${item.address || ''} ${item.notes || ''}`, words) * 8 }))
    .sort((a, b) => b.score - a.score || a.item.date.localeCompare(b.item.date))
    .slice(0, 24)
    .map(({ item }) => item);

  const reminders = [...context.reminders]
    .map((item) => ({ item, score: (item.eventId === activeEventId ? 90 : 0) + (recentIds.has(item.id) || (item.eventId ? recentIds.has(item.eventId) : false) ? 60 : 0) + scoreText(`${item.title} ${item.notes || ''}`, words) * 8 }))
    .sort((a, b) => b.score - a.score || (a.item.dueAt || '9999').localeCompare(b.item.dueAt || '9999'))
    .slice(0, 32)
    .map(({ item }) => item);

  const sheetRows = [...context.sheetRows]
    .map((item) => ({ item, score: (item.id === activeSheetRowId ? 120 : 0) + (item.eventId === activeEventId ? 90 : 0) + (recentIds.has(item.id) || (item.eventId ? recentIds.has(item.eventId) : false) ? 60 : 0) + scoreText(`${item.label} ${item.category} ${item.notes || ''} ${item.description || ''}`, words) * 8 }))
    .sort((a, b) => b.score - a.score || (b.item.updatedAt || b.item.createdAt).localeCompare(a.item.updatedAt || a.item.createdAt))
    .slice(0, 48)
    .map(({ item }) => item);

  return { events, reminders, sheetRows, recentIds };
}

function toConversationHistory(items: AssistantMemoryItem[]) {
  return items.slice(-10).flatMap((item) => {
    const internal = item.actionSummary?.length
      ? `\n[CONTEXTO INTERNO DE CONTINUIDAD: ${item.actionSummary.join(' | ')}]`
      : '';
    const undone = item.undoneAt ? '\n[CONTEXTO INTERNO: esta acción fue deshecha y ya no debe tratarse como activa.]' : '';
    return [
      { role: 'user', content: item.command.slice(0, 1200) },
      { role: 'assistant', content: `${item.result}${internal}${undone}`.slice(0, 1800) }
    ];
  }).slice(-20);
}

function sessionMemory(history: AssistantMemoryItem[], uiContext: AssistantUiContext | undefined, recentIds: Set<string>, activeSheetRowId?: string) {
  const lastTurn = history[history.length - 1];
  const previousTurn = history[history.length - 2];
  const pendingQuestion = lastTurn?.result?.includes('?') ? lastTurn.result.slice(0, 500) : '';
  const goal = lastTurn?.command || previousTurn?.command || '';
  const summary = [
    `[ESTADO DE SESIÓN CONTINUA]`,
    `pantalla=${uiContext?.view || 'desconocida'}`,
    uiContext?.activeEventId ? `eventoActivo=${uiContext.activeEventId} (${uiContext.activeEventTitle || ''})` : 'eventoActivo=ninguno',
    activeSheetRowId ? `filaExcelActiva=${activeSheetRowId}` : 'filaExcelActiva=ninguna',
    goal ? `objetivoReciente=${goal.slice(0, 500)}` : 'objetivoReciente=ninguno',
    pendingQuestion ? `preguntaPendiente=${pendingQuestion}` : 'preguntaPendiente=ninguna',
    `idsRecientes=${[...recentIds].slice(0, 20).join(',') || 'ninguno'}`,
    `Interpreta referencias como “eso”, “esa parte”, “los anteriores”, “continúa” o “corrige” dentro de esta misma sesión antes de tratarlas como una orden nueva.`
  ];
  return { role: 'assistant', content: summary.join('\n') };
}

export async function askAssistantWithMemory(
  command: string,
  context: Context,
  recentHistory: AssistantMemoryItem[] = [],
  uiContext?: AssistantUiContext
): Promise<AssistantResponse> {
  const workerUrl = (import.meta.env.VITE_DJNOA_WORKER_URL || window.location.origin).trim();

  if (workerUrl && navigator.onLine) {
    try {
      const sheetColumns = await db.sheetColumns.orderBy('position').toArray();
      const activeSheetRowId = localStorage.getItem('djnoa.activeSheetRowId') || undefined;
      const activeSheetRow = activeSheetRowId ? context.sheetRows.find((row) => row.id === activeSheetRowId) : undefined;
      const focused = focusedContext(command, context, recentHistory, uiContext, activeSheetRowId);
      const history = [...toConversationHistory(recentHistory), sessionMemory(recentHistory, uiContext, focused.recentIds, activeSheetRowId)];

      const response = await fetch(`${workerUrl.replace(/\/$/, '')}/api/assistant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          command,
          now: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
          locale: 'es-MX',
          history,
          uiContext: {
            ...uiContext,
            activeSheetRowId: activeSheetRow?.id,
            activeSheetRowLabel: activeSheetRow?.label,
            activeSheetRowCategory: activeSheetRow?.category,
            activeSheetRowAmount: activeSheetRow?.amount,
            activeSheetRowStatus: activeSheetRow?.status,
            activeSheetRowEventId: activeSheetRow?.eventId
          },
          context: {
            events: focused.events,
            reminders: focused.reminders,
            sheetRows: focused.sheetRows,
            sheetColumns: sheetColumns.slice(0, 40)
          }
        })
      });
      if (response.ok) {
        const result = resolvePureTotal((await response.json()) as AssistantResponse, context);
        return await previewAssistantResponse(result);
      }
    } catch {
      // If the connected AI is unavailable, keep the local assistant usable.
    }
  }

  const localResult = resolvePureTotal(await askAssistant(command, context), context);
  return await previewAssistantResponse(localResult);
}
