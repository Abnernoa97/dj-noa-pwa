type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = { AI: AiBinding };
type ChatTurn = { role?: string; content?: string };
type EventSnapshot = Record<string, unknown>;
type EventAction = Record<string, unknown>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function readText(result: unknown) {
  const value = result as { response?: string; choices?: Array<{ message?: { content?: string } }> };
  return String(value?.choices?.[0]?.message?.content || value?.response || '').trim();
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(trimmed.slice(first, last + 1)) as Record<string, unknown>; } catch { return null; }
    }
    return null;
  }
}

function cleanString(value: unknown, max = 500) {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim().slice(0, max);
  return clean || undefined;
}

function cleanTime(value: unknown) {
  const text = cleanString(value, 8);
  if (!text) return undefined;
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function cleanDate(value: unknown) {
  const text = cleanString(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function cleanStatus(value: unknown) {
  return value === 'confirmed' || value === 'tentative' || value === 'done' ? value : undefined;
}

function sanitizePatch(raw: unknown) {
  if (!raw || typeof raw !== 'object') return {};
  const value = raw as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const strings = ['title', 'venue', 'address', 'details', 'dressCode', 'contactName', 'contactPhone', 'mapUrl', 'notes'] as const;
  for (const key of strings) {
    if (key in value) patch[key] = typeof value[key] === 'string' ? String(value[key]).trim().slice(0, 900) : '';
  }
  if ('date' in value) {
    const date = cleanDate(value.date);
    if (date) patch.date = date;
  }
  for (const key of ['time', 'callTime', 'soundcheckTime', 'showTime'] as const) {
    if (key in value) patch[key] = cleanTime(value[key]) || '';
  }
  if ('status' in value) {
    const status = cleanStatus(value.status);
    if (status) patch.status = status;
  }
  return patch;
}

function sanitizeActions(raw: unknown, eventIds: Set<string>) {
  if (!Array.isArray(raw)) return [];
  const actions: EventAction[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const action = item as Record<string, unknown>;
    const type = String(action.type || '');

    if (type === 'open_events') {
      actions.push({ type });
      continue;
    }

    if (type === 'create_event') {
      const event = action.event && typeof action.event === 'object' ? action.event as Record<string, unknown> : {};
      const title = cleanString(event.title, 180);
      const date = cleanDate(event.date);
      if (!title || !date) continue;
      const cleanEvent = sanitizePatch(event);
      cleanEvent.title = title;
      cleanEvent.date = date;
      if (!cleanEvent.status) cleanEvent.status = 'confirmed';
      actions.push({ type, event: cleanEvent });
      continue;
    }

    const eventId = cleanString(action.eventId, 120);
    if (!eventId || !eventIds.has(eventId)) continue;

    if (type === 'update_event') {
      const patch = sanitizePatch(action.patch);
      if (Object.keys(patch).length) actions.push({ type, eventId, patch });
    } else if (type === 'delete_event' || type === 'open_event') {
      actions.push({ type, eventId });
    }
  }
  return actions;
}

function mutationIntent(text: string) {
  return /\b(crea|crear|creame|agrega|añade|pon|edita|editar|cambia|cambiar|modifica|actualiza|mueve|reprograma|borra|borrar|elimina|eliminar|abre|abrir)\b/i.test(text);
}

function systemPrompt(contextText: string) {
  return `Eres Noah, el asistente de voz personal de DJ NOA. Hablas español de México, natural, breve y preciso. En esta etapa tienes control TOTAL de la sección EVENTOS y ninguna otra sección todavía.

FUENTE DE VERDAD DE EVENTOS:
${contextText}

CAPACIDADES EN EVENTOS:
- leer, buscar, resumir y contestar preguntas usando exclusivamente los eventos recibidos;
- crear eventos;
- editar título, fecha, hora, llamada, prueba de sonido, show, venue, dirección, detalles, vestuario, contacto, teléfono, Maps, notas y estado;
- borrar eventos;
- abrir la lista de Eventos o una ficha concreta.

REGLAS:
1. Nunca inventes un eventId. Para update/delete/open usa EXACTAMENTE un id de CURRENT_EVENTS.
2. Si hay ambigüedad entre dos eventos, pregunta cuál y devuelve cero acciones.
3. Para fechas relativas usa CURRENT_LOCAL_DATETIME. Devuelve fechas YYYY-MM-DD y horas HH:mm en formato 24h.
4. Puedes devolver varias acciones en orden si el usuario pide varias cosas en una sola frase.
5. Para consultas solamente, eventActions debe ser [].
6. Si el usuario pide algo de Calendario, Excel, Tareas, MLB o NBA, explica en una frase que ahora estamos terminando Eventos.
7. No afirmes que una acción ya se ejecutó si no la incluyes en eventActions.
8. Respuesta hablada muy corta: normalmente una sola frase.

RESPONDE SOLO JSON VÁLIDO, sin markdown, con esta forma exacta:
{"reply":"frase breve","eventActions":[]}

Acciones permitidas:
{"type":"open_events"}
{"type":"open_event","eventId":"id existente"}
{"type":"create_event","event":{"title":"...","date":"YYYY-MM-DD","showTime":"HH:mm","venue":"...","status":"confirmed"}}
{"type":"update_event","eventId":"id existente","patch":{"venue":"..."}}
{"type":"delete_event","eventId":"id existente"}`;
}

async function runModel(env: Env, messages: Array<{ role: string; content: string }>, reliable: boolean) {
  if (reliable) {
    try {
      return await env.AI.run(
        '@cf/google/gemma-4-26b-a4b-it',
        {
          messages,
          response_format: { type: 'json_object' },
          temperature: 0,
          max_completion_tokens: 1400,
          chat_template_kwargs: { enable_thinking: false }
        },
        { rejectIfBusy: false }
      );
    } catch (error) {
      console.warn('Noah Events reliable model fallback', error);
    }
  }

  return env.AI.run(
    '@cf/meta/llama-3.1-8b-instruct-fast',
    { messages, temperature: 0, max_tokens: 650 },
    { rejectIfBusy: false }
  );
}

export async function handleNoahChat(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await request.json() as {
      message?: string;
      history?: ChatTurn[];
      context?: { section?: string; localDateTime?: string; timezoneOffsetMinutes?: number; events?: EventSnapshot[] };
    };
    const message = String(body?.message || '').trim().slice(0, 1600);
    if (!message) return json({ error: 'message_required' }, 400);

    const events = Array.isArray(body.context?.events)
      ? body.context!.events!.slice(0, 80).map((event) => ({
          id: cleanString(event.id, 120),
          title: cleanString(event.title, 180),
          date: cleanDate(event.date),
          time: cleanTime(event.time),
          callTime: cleanTime(event.callTime),
          soundcheckTime: cleanTime(event.soundcheckTime),
          showTime: cleanTime(event.showTime),
          venue: cleanString(event.venue, 240),
          address: cleanString(event.address, 300),
          details: cleanString(event.details, 500),
          dressCode: cleanString(event.dressCode, 160),
          contactName: cleanString(event.contactName, 160),
          contactPhone: cleanString(event.contactPhone, 100),
          mapUrl: cleanString(event.mapUrl, 500),
          notes: cleanString(event.notes, 500),
          status: cleanStatus(event.status)
        })).filter((event) => event.id && event.title && event.date)
      : [];

    const eventIds = new Set(events.map((event) => String(event.id)));
    const contextText = JSON.stringify({
      CURRENT_LOCAL_DATETIME: cleanString(body.context?.localDateTime, 100) || new Date().toISOString(),
      TIMEZONE_OFFSET_MINUTES: Number(body.context?.timezoneOffsetMinutes || 0),
      CURRENT_SECTION: cleanString(body.context?.section, 40) || 'unknown',
      CURRENT_EVENTS: events
    });

    const history = Array.isArray(body.history)
      ? body.history.slice(-10).map((item) => ({
          role: item?.role === 'assistant' ? 'assistant' : 'user',
          content: String(item?.content || '').trim().slice(0, 900)
        })).filter((item) => item.content)
      : [];

    const messages = [
      { role: 'system', content: systemPrompt(contextText) },
      ...history,
      { role: 'user', content: message }
    ];

    const result = await runModel(env, messages, mutationIntent(message));
    const raw = readText(result);
    const parsed = parseJsonObject(raw);

    if (!parsed) {
      const text = raw.replace(/```(?:json)?|```/gi, '').trim().slice(0, 700);
      return json({ text: text || 'No entendí bien. Dímelo otra vez.', eventActions: [] });
    }

    const reply = cleanString(parsed.reply, 700) || 'Listo.';
    const eventActions = sanitizeActions(parsed.eventActions, eventIds);
    return json({ text: reply, eventActions });
  } catch (error) {
    console.error('Noah chat failed', error);
    return json({ error: 'chat_unavailable' }, 503);
  }
}
