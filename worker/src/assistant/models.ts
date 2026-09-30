import { conversationMessages, looksComplex } from './prompt';
import type { AssistantMessage, DjNoaAiEnv, ParsedAssistant, RequestBody } from './types';

function readModelText(result: unknown) {
  const data = result as {
    response?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  return String(data?.choices?.[0]?.message?.content || data?.response || '').trim();
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validAssistant(value: unknown): value is Required<Pick<ParsedAssistant, 'reply' | 'actions'>> {
  const parsed = value as ParsedAssistant | null;
  return Boolean(parsed && typeof parsed.reply === 'string' && Array.isArray(parsed.actions));
}

async function runFast(env: DjNoaAiEnv, messages: AssistantMessage[]) {
  const result = await env.AI.run(
    '@cf/meta/llama-3.1-8b-instruct-fast',
    {
      messages,
      temperature: 0,
      max_tokens: 900
    },
    { rejectIfBusy: false }
  );
  const parsed = parseJsonObject(readModelText(result));
  return validAssistant(parsed) ? parsed : null;
}

async function runReliable(env: DjNoaAiEnv, messages: AssistantMessage[]) {
  const result = await env.AI.run(
    '@cf/google/gemma-4-26b-a4b-it',
    {
      messages,
      response_format: { type: 'json_object' },
      temperature: 0,
      max_completion_tokens: 2000,
      chat_template_kwargs: { enable_thinking: false }
    },
    { rejectIfBusy: false }
  );
  const parsed = parseJsonObject(readModelText(result));
  return validAssistant(parsed) ? parsed : null;
}

export async function runAssistant(env: DjNoaAiEnv, body: RequestBody, text: string) {
  const messages = conversationMessages(body, text);
  const preferReliable = body.inputMode === 'voice' || looksComplex(text);

  if (preferReliable) {
    try {
      const reliable = await runReliable(env, messages);
      if (reliable) return reliable;
    } catch (error) {
      console.warn('DJ NOA reliable model fallback', error);
    }
    return runFast(env, messages);
  }

  try {
    const fast = await runFast(env, messages);
    if (fast) return fast;
  } catch (error) {
    console.warn('DJ NOA fast model fallback', error);
  }

  return runReliable(env, messages);
}
