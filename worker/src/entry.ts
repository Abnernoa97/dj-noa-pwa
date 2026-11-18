import { json } from './shared/http';
import baseWorker, { ReminderScheduler } from './index';
import { handleMlbRequest } from './sports/mlb';
import { handleNbaRequest } from './sports/nba';
import { handleNoahChat } from './noah/noahChat';
import { handleNoahImage } from './noah/noahImage';
import { handleSportsAnalysis } from './sports/sportsAnalysis';
import { handleSportsContext } from './sports/sportsContext';
import { handleSportsLive } from './sports/sportsLive';

export { ReminderScheduler };

type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = {
  AI: AiBinding;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  ASSETS: Fetcher;
};

const MAX_AI_BYTES = 96_000;
const MAX_IMAGE_AI_BYTES = 5_500_000;



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

async function enforceRateLimit(request: Request, env: Env) {
  const id = env.REMINDER_SCHEDULER.idFromName('personal');
  const client = request.headers.get('cf-connecting-ip') || 'unknown';
  const internal = new Request('https://dj-noa.internal/api/internal/rate-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'assistant', client })
  });
  const response = await env.REMINDER_SCHEDULER.get(id).fetch(internal);
  if (response.ok) return null;
  return json({ error: 'rate_limited' }, 429, { 'retry-after': response.headers.get('retry-after') || '60' });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/health' && !requestComesFromApp(request, url)) {
      return json({ error: 'forbidden_source' }, 403);
    }

    if (url.pathname === '/api/mlb') return handleMlbRequest(request);
    if (url.pathname === '/api/nba') return handleNbaRequest(request);
    if (url.pathname === '/api/sports-context') return handleSportsContext(request);
    if (url.pathname === '/api/sports-live') return handleSportsLive(request);

    if (url.pathname === '/api/sports-analysis') {
      if (declaredBodyTooLarge(request, MAX_AI_BYTES)) return json({ error: 'request_too_large' }, 413);
      const limited = await enforceRateLimit(request, env);
      if (limited) return limited;
      return handleSportsAnalysis(request, env);
    }

    if (url.pathname === '/api/noah-image') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      if (declaredBodyTooLarge(request, MAX_IMAGE_AI_BYTES)) return json({ error: 'request_too_large' }, 413);
      const limited = await enforceRateLimit(request, env);
      if (limited) return limited;
      return handleNoahImage(request, env);
    }

    if (url.pathname === '/api/noah-chat') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      if (declaredBodyTooLarge(request, MAX_AI_BYTES)) return json({ error: 'request_too_large' }, 413);
      const limited = await enforceRateLimit(request, env);
      if (limited) return limited;
      return handleNoahChat(request, env);
    }

    return baseWorker.fetch(request, env as never);
  }
} satisfies ExportedHandler<Env>;
