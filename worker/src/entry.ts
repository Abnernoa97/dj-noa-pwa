import baseWorker, { ReminderScheduler } from './index';
import { handleDjNoaAssistant } from './djNoaAssistant';
import { expandDeterministicRecurrence } from './deterministicRecurrence';
import { handleMlbRequest } from './mlb';
import { handleNbaRequest } from './nba';
import { handleSportsAnalysis } from './sportsAnalysis';

export { ReminderScheduler };

type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = {
  AI: AiBinding;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  ASSETS: Fetcher;
};

type RateKind = 'assistant' | 'transcribe';

const MAX_ASSISTANT_BYTES = 1_500_000;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

function requestComesFromApp(request: Request, url: URL) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return false;

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).origin !== url.origin) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function declaredBodyTooLarge(request: Request, limit: number) {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const size = Number(raw);
  return Number.isFinite(size) && size > limit;
}

async function enforceRateLimit(request: Request, env: Env, kind: RateKind) {
  const id = env.REMINDER_SCHEDULER.idFromName('personal');
  const client = request.headers.get('cf-connecting-ip') || 'unknown';
  const internal = new Request('https://dj-noa.internal/api/internal/rate-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, client })
  });
  const response = await env.REMINDER_SCHEDULER.get(id).fetch(internal);
  if (response.ok) return null;
  return json({ error: 'rate_limited' }, 429, { 'retry-after': response.headers.get('retry-after') || '60' });
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function handleTranscription(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (declaredBodyTooLarge(request, MAX_AUDIO_BYTES)) return json({ error: 'audio_too_large' }, 413);

  const audio = await request.arrayBuffer();
  if (!audio.byteLength) return json({ text: '' });
  if (audio.byteLength > MAX_AUDIO_BYTES) return json({ error: 'audio_too_large' }, 413);

  try {
    const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: arrayBufferToBase64(audio),
      task: 'transcribe',
      language: 'es',
      vad_filter: true,
      condition_on_previous_text: false,
      no_speech_threshold: 0.55
    }, { rejectIfBusy: false }) as { text?: string; transcription_info?: { text?: string } };

    const text = String(result?.text || result?.transcription_info?.text || '').trim();
    return json({ text });
  } catch (error) {
    console.error('DJ NOA transcription error', error);
    return json({ error: 'transcription_unavailable' }, 503);
  }
}

async function handleAssistantWithDeterminism(request: Request, env: Env) {
  let command = '';
  try {
    const body = await request.clone().json() as { command?: string; text?: string };
    command = String(body.command || body.text || '').trim();
  } catch {
    // The assistant itself will return the canonical invalid-request response.
  }

  const response = await handleDjNoaAssistant(request, env);
  if (!response.ok || !command) return response;

  try {
    const payload = await response.clone().json() as { reply?: string; actions?: Array<Record<string, unknown>> };
    const expanded = expandDeterministicRecurrence(command, payload);
    return json(expanded, response.status);
  } catch {
    return response;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/health' && !requestComesFromApp(request, url)) {
      return json({ error: 'forbidden_source' }, 403);
    }

    if (url.pathname === '/api/mlb') {
      return handleMlbRequest(request);
    }

    if (url.pathname === '/api/nba') {
      return handleNbaRequest(request);
    }

    if (url.pathname === '/api/sports-analysis') {
      if (declaredBodyTooLarge(request, MAX_ASSISTANT_BYTES)) return json({ error: 'request_too_large' }, 413);
      const limited = await enforceRateLimit(request, env, 'assistant');
      if (limited) return limited;
      return handleSportsAnalysis(request, env);
    }

    if (url.pathname === '/api/assistant') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      if (declaredBodyTooLarge(request, MAX_ASSISTANT_BYTES)) return json({ error: 'request_too_large' }, 413);
      const limited = await enforceRateLimit(request, env, 'assistant');
      if (limited) return limited;
      return handleAssistantWithDeterminism(request, env);
    }

    if (url.pathname === '/api/transcribe') {
      const limited = await enforceRateLimit(request, env, 'transcribe');
      if (limited) return limited;
      return handleTranscription(request, env);
    }

    return baseWorker.fetch(request, env as never);
  }
} satisfies ExportedHandler<Env>;
