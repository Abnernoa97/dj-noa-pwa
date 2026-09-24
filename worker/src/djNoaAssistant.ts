type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

export type DjNoaAiEnv = { AI: AiBinding };

type RequestBody = {
  text?: string;
  command?: string;
  now?: string;
  timezone?: string;
  locale?: string;
  history?: Array<{ role?: string; content?: string }>;
  context?: {
    events?: Record<string, unknown>[];
    reminders?: Record<string, unknown>[];
    sheetRows?: Record<string, unknown>[];
  };
};

type ParsedAssistant = {
  reply?: string;
  actions?: unknown[];
};

const allowedActions = new Set([
  'create_event', 'update_event', 'delete_event',
  'create_reminder', 'update_reminder', 'delete_reminder',
  'add_sheet_row', 'update_sheet_row', 'delete_sheet_row',
  'add_sheet_column', 'navigate', 'open_map', 'query_total', 'none'
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

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

function idsFrom(items: Record<string, unknown>[] | undefined) {
  return new Set((items || []).map((item) => String(item.id || '')).filter(Boolean));
}

function isIsoDate(value: unknown) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(String(value || ''));
}

function actionIsSafe(action: unknown, body: RequestBody) {
  if (!action || typeof action !== 'object') return false;
  const value = action as Record<string, unknown>;
  const type = String(value.type || '');
  if (!allowedActions.has(type)) return false;

  const events = idsFrom(body.context?.events);
  const reminders = idsFrom(body.context?.reminders);
  const rows = idsFrom(body.context?.sheetRows);

  if (type === 'create_event') return Boolean(String(value.title || '').trim() && isIsoDate(value.date));
  if (type === 'update_event' || type === 'delete_event' || type === 'open_map') return events.has(String(value.eventId || ''));
  if (type === 'create_reminder') return Boolean(String(value.title || '').trim());
  if (type === 'update_reminder' || type === 'delete_reminder') return reminders.has(String(value.reminderId || ''));
  if (type === 'add_sheet_row') return Boolean(String(value.label || '').trim() && String(value.category || '').trim() && Number.isFinite(Number(value.amount)));
  if (type === 'update_sheet_row' || type === 'delete_sheet_row') return rows.has(String(value.rowId || ''));
  if (type === 'add_sheet_column') return Boolean(String(value.name || '').trim());
  if (type === 'navigate') return ['home', 'events', 'calendar', 'sheet', 'reminders'].includes(String(value.view || ''));
  return true;
}

function looksComplex(text: string) {
  const normalized = text.toLowerCase();
  const correction = /\b(no|mejor|perd[oó]n|corrijo|m[aá]s bien|bueno|espera)\b/.test(normalized);
  const chained = (normalized.match(/\b(crea|crear|agenda|agrega|a[nñ]ade|recu[eé]rdame|cambia|mueve|edita|modifica|actualiza|borra|elimina|abre|ll[eé]vame)\b/g) || []).length >= 2;
  const references = /\b(eso|ese|esa|lo|la|ah[ií]|el mismo|la misma|ese evento|esa tarea)\b/.test(normalized);
  return correction || chained || references || text.length > 130;
}

function systemPrompt(body: RequestBody) {
  const context = body.context || {};
  const now = body.now || new Date().toISOString();
  const timezone = body.timezone || 'America/Mexico_City';
  const locale = body.locale || 'es-MX';

  return `Eres DJ NOA, el asistente privado de una sola persona para organizar eventos, calendario, gastos/Excel y recordatorios. Hablas español natural, breve, cálido y directo. Tu prioridad es entender correctamente antes de actuar.

FECHA/HORA ACTUAL: ${now}
ZONA HORARIA: ${timezone}
LOCALE: ${locale}

EVENTOS: ${JSON.stringify(context.events || [])}
RECORDATORIOS: ${JSON.stringify(context.reminders || [])}
EXCEL/GASTOS: ${JSON.stringify(context.sheetRows || [])}

Devuelve SIEMPRE un único objeto JSON válido, sin markdown ni texto fuera del JSON:
{"reply":"respuesta corta","actions":[...]}

ACCIONES PERMITIDAS:
EVENTOS
{"type":"create_event","title":"texto","date":"YYYY-MM-DD","time":"HH:MM opcional","venue":"opcional","address":"opcional","notes":"opcional","status":"confirmed|tentative|done opcional"}
{"type":"update_event","eventId":"ID EXACTO DEL CONTEXTO","title":"opcional","date":"YYYY-MM-DD opcional","time":"HH:MM opcional","venue":"opcional","address":"opcional","notes":"opcional","status":"confirmed|tentative|done opcional"}
{"type":"delete_event","eventId":"ID EXACTO DEL CONTEXTO"}
{"type":"open_map","eventId":"ID EXACTO DEL CONTEXTO"}

RECORDATORIOS
{"type":"create_reminder","title":"texto","dueAt":"ISO 8601 opcional","eventId":"ID exacto opcional","notes":"opcional","priority":"low|normal|high","repeat":"none|daily|weekly|monthly","notificationEnabled":true}
{"type":"update_reminder","reminderId":"ID EXACTO DEL CONTEXTO","title":"opcional","dueAt":"ISO 8601 opcional","eventId":"ID exacto opcional","notes":"opcional","priority":"low|normal|high opcional","repeat":"none|daily|weekly|monthly opcional","notificationEnabled":true,"done":false}
{"type":"delete_reminder","reminderId":"ID EXACTO DEL CONTEXTO"}

EXCEL / GASTOS
{"type":"add_sheet_row","label":"texto","category":"texto","amount":8500,"status":"pending|paid|info","notes":"opcional","eventId":"ID exacto opcional","calendarDate":"YYYY-MM-DD opcional"}
{"type":"update_sheet_row","rowId":"ID EXACTO DEL CONTEXTO","label":"opcional","category":"opcional","amount":8500,"status":"pending|paid|info opcional","notes":"opcional","eventId":"ID exacto opcional","calendarDate":"YYYY-MM-DD opcional"}
{"type":"delete_sheet_row","rowId":"ID EXACTO DEL CONTEXTO"}
{"type":"add_sheet_column","name":"texto","key":"opcional","columnType":"text|number|currency|date|formula","formula":"opcional"}
{"type":"query_total","category":"opcional","status":"pending|paid|info opcional"}

NAVEGACIÓN
{"type":"navigate","view":"home|events|calendar|sheet|reminders"}
{"type":"none"}

REGLAS DE INTERPRETACIÓN:
- Escucha el mensaje completo como una sola intención. El usuario puede pensar en voz alta, dudar y corregirse antes de terminar.
- Si el usuario dice valores distintos y luego se corrige con frases como “no”, “mejor”, “perdón”, “más bien”, “bueno” o “corrijo”, SIEMPRE manda la última decisión explícita. Ejemplo: “el 18... no, mejor el 20 de octubre” significa 20 de octubre, no 18.
- Ignora muletillas, repeticiones y fragmentos abandonados. No conviertas cada fragmento hablado en una acción distinta.
- Entiende fechas naturales en español, nombres de meses, hoy, mañana, pasado mañana, días de la semana y expresiones relativas usando la fecha actual.
- Entiende cantidades habladas como “8 mil”, “ocho mil”, “8 mil quinientos”, etc. y conviértelas a número.
- Si una orden contiene varias tareas independientes, devuelve todas las acciones necesarias en el orden natural de ejecución.
- Si en una misma orden se crea un evento nuevo y también un gasto relacionado, NO inventes un eventId para el evento recién creado. Omite eventId, pero usa calendarDate con la fecha del evento cuando ayude a mantenerlos juntos en Calendario.
- Si en una misma orden se crea un evento nuevo y un recordatorio relativo a ese evento, calcula dueAt a partir de la fecha indicada, pero NO inventes eventId.
- Para modificar, borrar o abrir algo existente, usa SIEMPRE el ID exacto presente en el contexto. Nunca inventes IDs.
- Si hay dos candidatos posibles o no está claro cuál es, pregunta antes y usa none.
- Si falta un dato imprescindible para ejecutar con seguridad (por ejemplo la fecha de un evento nuevo), pregunta antes y usa none. No adivines.
- Para preguntas como “qué tengo hoy”, “cuál es mi próximo evento”, “cuánto tengo pendiente” o “qué tareas tengo”, responde usando el contexto y usa none o query_total.
- Solo borra cuando el usuario lo pida claramente. No conviertas “quítalo de la vista”, “ocúltalo” o frases dudosas en borrado.
- No afirmes que un cambio ya ocurrió antes de devolver la acción correspondiente.
- No incluyas explicaciones técnicas.
- Máximo 2 frases en reply.`;
}

function conversationMessages(body: RequestBody, text: string) {
  const history = Array.isArray(body.history)
    ? body.history
        .slice(-8)
        .map((item) => ({
          role: item?.role === 'assistant' ? 'assistant' : 'user',
          content: String(item?.content || '').slice(0, 320)
        }))
        .filter((item) => item.content.trim())
    : [];

  return [
    { role: 'system', content: systemPrompt(body) },
    ...history,
    { role: 'user', content: text }
  ];
}

async function runFast(env: DjNoaAiEnv, messages: Array<{ role: string; content: string }>) {
  const result = await env.AI.run(
    '@cf/meta/llama-3.1-8b-instruct-fast',
    {
      messages,
      temperature: 0,
      max_tokens: 520
    },
    { rejectIfBusy: false }
  );
  const parsed = parseJsonObject(readModelText(result));
  return validAssistant(parsed) ? parsed : null;
}

async function runReliable(env: DjNoaAiEnv, messages: Array<{ role: string; content: string }>) {
  const result = await env.AI.run(
    '@cf/google/gemma-4-26b-a4b-it',
    {
      messages,
      response_format: { type: 'json_object' },
      temperature: 0,
      max_completion_tokens: 800,
      chat_template_kwargs: { enable_thinking: false }
    },
    { rejectIfBusy: false }
  );
  const parsed = parseJsonObject(readModelText(result));
  return validAssistant(parsed) ? parsed : null;
}

async function runAssistant(env: DjNoaAiEnv, body: RequestBody, text: string) {
  const messages = conversationMessages(body, text);

  if (looksComplex(text)) {
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
      return json({ reply: 'Entendí parte de la orden, pero prefiero que me la repitas para no hacer algo incorrecto.', actions: [{ type: 'none' }] });
    }

    const actions = parsed.actions.filter((action) => actionIsSafe(action, body)).slice(0, 10);
    const safeActions = actions.length ? actions : [{ type: 'none' }];

    return json({
      reply: parsed.reply.slice(0, 500),
      actions: safeActions
    });
  } catch (error) {
    console.error('DJ NOA AI error', error);
    return json({ reply: 'Mi inteligencia artificial no está disponible en este momento. Inténtalo de nuevo en unos segundos.', actions: [{ type: 'none' }] }, 503);
  }
}
