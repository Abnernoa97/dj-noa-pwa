import { runAssistant } from './assistant/models';
import type { DjNoaAiEnv, RequestBody } from './assistant/types';
import {
  actionIsSafe,
  deleteIsConfirmed,
  destructiveConfirmationMessage,
  isDeleteAction
} from './assistant/validation';

export type { DjNoaAiEnv } from './assistant/types';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function handleDjNoaAssistant(request: Request, env: DjNoaAiEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return json({ reply: 'No entendí la solicitud.', actions: [{ type: 'none' }] }, 400);
  }

  const text = String(body.text || body.command || '').trim();
  if (!text) return json({ reply: 'Dime qué necesitas.', actions: [{ type: 'none' }] });

  try {
    const parsed = await runAssistant(env, body, text);
    if (!parsed) {
      return json({
        reply: 'Entendí parte de la orden, pero prefiero que me la repitas para no hacer algo incorrecto.',
        actions: [{ type: 'none' }]
      });
    }

    const destructiveActions = parsed.actions.filter(isDeleteAction);
    if (destructiveActions.length && !deleteIsConfirmed(text, body)) {
      return json({
        reply: destructiveConfirmationMessage(destructiveActions, body),
        actions: [{ type: 'none' }]
      });
    }

    const actions = parsed.actions.filter((action) => actionIsSafe(action, body)).slice(0, 30);
    const safeActions = actions.length ? actions : [{ type: 'none' }];

    return json({
      reply: parsed.reply.slice(0, 700),
      actions: safeActions
    });
  } catch (error) {
    console.error('DJ NOA AI error', error);
    return json({
      reply: 'Mi inteligencia artificial no está disponible en este momento. Inténtalo de nuevo en unos segundos.',
      actions: [{ type: 'none' }]
    }, 503);
  }
}
