type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = { AI: AiBinding };
type ChatTurn = { role?: string; content?: string };
type EventSnapshot = Record<string, unknown>;
type EventAction = Record<string, unknown>;
type NavigableSection = 'home' | 'events' | 'calendar' | 'sheet' | 'reminders';

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

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
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

function cleanSection(value: unknown): NavigableSection | undefined {
  return value === 'home' || value === 'events' || value === 'calendar' || value === 'sheet' || value === 'reminders' ? value : undefined;
}

function sanitizeActions(raw: unknown, eventIds: Set<string>) {
  if (!Array.isArray(raw)) return [];
  const actions: EventAction[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const action = item as Record<string, unknown>;
    const type = String(action.type || '');

    if (type === 'navigate_section') {
      const section = cleanSection(action.section);
      if (section) actions.push({ type, section });
      continue;
    }

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

function navigationIntent(text: string): { section: NavigableSection; reply: string } | null {
  const clean = normalize(text);
  const transition = '(?:pasemos|pasamos|pasar|pasaramos|vamos|vayamos|ve|abre|abrir|cambia|cambiemos|cambiar|ir|vamonos|llevame|llevame a|quiero ir)';
  const matches = (term: string) => new RegExp(`${transition}\\s+(?:a\\s+|al\\s+|la\\s+)?${term}\\b`).test(clean);

  if (matches('calendario')) return { section: 'calendar', reply: 'Perfecto, pasamos a Calendario.' };
  if (matches('eventos?')) return { section: 'events', reply: 'Perfecto, pasamos a Eventos.' };
  if (matches('excel') || matches('tabla')) return { section: 'sheet', reply: 'Perfecto, pasamos a Excel.' };
  if (matches('tareas?') || matches('recordatorios?')) return { section: 'reminders', reply: 'Perfecto, pasamos a Tareas.' };
  if (matches('inicio') || matches('home')) return { section: 'home', reply: 'Perfecto, volvemos a Inicio.' };
  return null;
}

function mutationIntent(text: string) {
  return /\b(crea|crear|creame|agrega|anade|añade|pon|edita|editar|cambia|cambiar|modifica|actualiza|mueve|reprograma|borra|borrar|elimina|eliminar|abre|abrir)\b/i.test(text);
}

function systemPrompt(contextText: string) {
  return `Eres Noah, el asistente personal de voz de DJ NOA. Hablas español de México como una persona: natural, continuo, breve y sin frases robóticas. Mantienes el hilo de la conversación aunque el usuario cambie de sección o de tema.

CONTEXTO ACTUAL:
${contextText}

HERRAMIENTAS DISPONIBLES AHORA:
- EVENTOS: leer, buscar, resumir, crear, editar, borrar y abrir eventos usando CURRENT_EVENTS.
- NAVEGACIÓN: puedes cambiar libremente entre Inicio, Eventos, Calendario, Excel y Tareas.

REGLAS DE CONVERSACIÓN:
1. Nunca discutas con el usuario sobre qué sección debe terminar primero. Si dice “terminamos Eventos, pasemos a Calendario”, simplemente cambia a Calendario.
2. Nunca digas “estamos terminando Eventos”, “todavía no hemos terminado Eventos” ni frases equivalentes.
3. Una respuesta hablada por turno. Corta, humana y directa. No enumeres en voz lo que la interfaz ya mostrará visualmente.
4. Mantén continuidad con HISTORY. Si el usuario cambia de tema, síguelo naturalmente.
5. No inventes datos ni acciones ejecutadas.

REGLAS DE EVENTOS:
1. Nunca inventes un eventId. Para update/delete/open usa EXACTAMENTE un id de CURRENT_EVENTS.
2. Si hay ambigüedad real entre dos eventos, pregunta cuál y devuelve cero acciones.
3. Para fechas relativas usa CURRENT_LOCAL_DATETIME. Devuelve fechas YYYY-MM-DD y horas HH:mm en formato 24h.
4. Puedes devolver varias acciones en orden si el usuario pide varias modificaciones en una sola frase.
5. Para consultas solamente, eventActions debe ser [].
6. Para cambios de sección usa navigate_section. Cambiar de sección NO termina la conversación.
7. Si el usuario pide una operación interna de Calendario, Excel o Tareas que aún no está representada por una acción disponible, no inventes que la hiciste. Puedes navegar a esa sección y continuar la conversación desde ahí.

RESPONDE SOLO JSON VÁLIDO, sin markdown:
{"reply":"una sola frase breve","eventActions":[]}

Acciones permitidas:
{"type":"navigate_section","section":"home|events|calendar|sheet|reminders"}
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
      console.warn('Noah reliable model fallback', error);
    }
  }

  return env.AI.run(
    '@cf/meta/llama-3.1-8b-instruct-fast',
    { messages, temperature: 0.1, max_tokens: 650 },
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

    const directNavigation = navigationIntent(message);
    if (directNavigation) {
      return json({
        text: directNavigation.reply,
        eventActions: [{ type: 'navigate_section', section: directNavigation.section }]
      });
    }

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
      ? body.history.slice(-12).map((item) => ({
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
      const text = raw.replace(/```(?:json)?|```/gi, '').trim().slice(0, 500);
      return json({ text: text || 'No entendí bien. Dímelo otra vez.', eventActions: [] });
    }

    const reply = cleanString(parsed.reply, 420) || 'Listo.';
    const eventActions = sanitizeActions(parsed.eventActions, eventIds);
    return json({ text: reply, eventActions });
  } catch (error) {
    console.error('Noah chat failed', error);
    return json({ error: 'chat_unavailable' }, 503);
  }
}
