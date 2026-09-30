export type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

export type DjNoaAiEnv = { AI: AiBinding };

export type RequestBody = {
  text?: string;
  command?: string;
  now?: string;
  timezone?: string;
  locale?: string;
  inputMode?: 'text' | 'voice';
  history?: Array<{ role?: string; content?: string }>;
  uiContext?: {
    view?: string;
    activeEventId?: string;
    activeEventTitle?: string;
    activeEventDate?: string;
    activeEventVenue?: string;
    activeSheetRowId?: string;
    activeSheetRowLabel?: string;
    activeSheetRowCategory?: string;
    activeSheetRowAmount?: number;
    activeSheetRowStatus?: string;
    activeSheetRowEventId?: string;
  };
  context?: {
    events?: Record<string, unknown>[];
    reminders?: Record<string, unknown>[];
    sheetRows?: Record<string, unknown>[];
    sheetColumns?: Record<string, unknown>[];
  };
};

export type ParsedAssistant = {
  reply?: string;
  actions?: unknown[];
};

export type AssistantMessage = { role: string; content: string };
