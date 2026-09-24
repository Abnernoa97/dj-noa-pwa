import baseWorker, { ReminderScheduler } from './index';
import { handleDjNoaAssistant } from './djNoaAssistant';

export { ReminderScheduler };

type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = {
  AI: AiBinding;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  ASSETS: Fetcher;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
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

  const audio = await request.arrayBuffer();
  if (!audio.byteLength) return json({ text: '' });
  if (audio.byteLength > 8 * 1024 * 1024) return json({ error: 'audio_too_large' }, 413);

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/assistant') {
      return handleDjNoaAssistant(request, env);
    }

    if (url.pathname === '/api/transcribe') {
      return handleTranscription(request, env);
    }

    return baseWorker.fetch(request, env as never);
  }
} satisfies ExportedHandler<Env>;
