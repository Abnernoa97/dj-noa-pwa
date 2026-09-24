import { askAssistant } from './assistant';
import type { AssistantResponse, EventItem, ReminderItem, SheetRow } from './types';

export type AssistantMemoryItem = {
  command: string;
  result: string;
  actionSummary?: string[];
  undoneAt?: string;
  kind?: 'command' | 'undo';
};

type Context = {
  events: EventItem[];
  reminders: ReminderItem[];
  sheetRows: SheetRow[];
};

function toConversationHistory(items: AssistantMemoryItem[]) {
  return items.slice(-6).flatMap((item) => {
    const internal = item.actionSummary?.length
      ? `\n[CONTEXTO INTERNO DE CONTINUIDAD: ${item.actionSummary.join(' | ')}]`
      : '';
    const undone = item.undoneAt ? '\n[CONTEXTO INTERNO: esta acción fue deshecha y ya no debe tratarse como activa.]' : '';
    return [
      { role: 'user', content: item.command.slice(0, 500) },
      { role: 'assistant', content: `${item.result}${internal}${undone}`.slice(0, 900) }
    ];
  }).slice(-10);
}

export async function askAssistantWithMemory(
  command: string,
  context: Context,
  recentHistory: AssistantMemoryItem[] = []
): Promise<AssistantResponse> {
  const workerUrl = (localStorage.getItem('djnoa.workerUrl') || import.meta.env.VITE_DJNOA_WORKER_URL || window.location.origin).trim();

  if (workerUrl && navigator.onLine) {
    try {
      const response = await fetch(`${workerUrl.replace(/\/$/, '')}/api/assistant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          command,
          now: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
          locale: 'es-MX',
          history: toConversationHistory(recentHistory),
          context: {
            events: context.events.slice(0, 40),
            reminders: context.reminders.slice(0, 40),
            sheetRows: context.sheetRows.slice(0, 100)
          }
        })
      });
      if (response.ok) return (await response.json()) as AssistantResponse;
    } catch {
      // If the connected AI is unavailable, keep the local assistant usable.
    }
  }

  return askAssistant(command, context);
}
