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
  uiContext?: {
    view?: string;
    activeEventId?: string;
    activeEventTitle?: string;
    activeEventDate?: string;
    activeEventVenue?: string;
  };
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

function eventRefIsSafe(value: Record<string, unknown>) {
  return value.eventRef === undefined || value.eventRef === 'created_event';
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
  if (type === 'create_reminder') return Boolean(String(value.title || '').trim() && eventRefIsSafe(value));
  if (type === 'update_reminder' || type === 'delete_reminder') return reminders.has(String(value.reminderId || ''));
  if (type === 'add_sheet_row') return Boolean(String(value.label || '').trim() && String(value.category || '').trim() && Number.isFinite(Number(value.amount)) && eventRefIsSafe(value));
  if (type === 'update_sheet_row' || type === 'delete_sheet_row') return rows.has(String(value.rowId || ''));
  if (type === 'add_sheet_column') return Boolean(String(value.name || '').trim());
  if (type === 'navigate') return ['home', 'events', 'calendar', 'sheet', 'reminders'].includes(String(value.view || ''));
  return true;
}

function looksComplex(text: string) {
  const normalized = text.toLowerCase();
  const correction = /\b(no|mejor|perd[oó]n|corrijo|m[aá]s bien|bueno|espera)\b/.test(normalized);
  const chained = (normalized.match(/\b(crea|crear|agenda|agrega|a[nñ]ade|recu[eé]rdame|cambia|mueve|edita|modifica|actualiza|borra|elimina|abre|ll[eé]vame)\b/g) || []).length >= 2;
  const references = /\b(eso|ese|esa|lo|la|ah[ií]|aqu[ií]|este|esta|el mismo|la misma|ese evento|esa tarea)\b/.test(normalized);
  return correction || chained || references || text.length > 130;
}

function isDeleteAction(action: unknown) {
  if (!action || typeof action !== 'object') return false;
  const type = String((action as Record<string, unknown>).type || '');
  return type === 'delete_event' || type === 'delete_reminder' || type === 'delete_sheet_row';
}

function lastAssistantHistory(body: RequestBody) {
  const history = Array.isArray(body.history) ? body.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (item?.role === 'assistant' && String(item.content || '').trim()) return String(item.content || '');
  }
  return '';
}

function deleteIsConfirmed(text: string, body: RequestBody) {
  const normalized = text.toLowerCase().trim();
  const explicitSameTurn = /\b(estoy segur[oa]|confirmo(?:\s+la\s+eliminaci[oó]n)?|s[ií],?\s*(?:b[oó]rralo|elim[ií]nalo|hazlo)|elim[ií]nalo definitivamente|b[oó]rralo definitivamente)\b/i.test(normalized);
  if (explicitSameTurn) return true;

  const previousAssistant = lastAssistantHistory(body);
  const askedForConfirmation = /\b(confirmas|confirmar|est[aá]s segur[oa]|seguro que quieres|quieres eliminar|quieres borrar)\b/i.test(previousAssistant);
  const shortConfirmation = /^\s*(s[ií]|confirmo|adelante|hazlo|de acuerdo|ok(?:ay)?|correcto|confirmado)(?:[,.!\s].*)?$/i.test(text);
  return askedForConfirmation && shortConfirmation;
}

function findById(items: Record<string, unknown>[] | undefined, id: string) {
  return (items || []).find((item) => String(item.id || '') === id);
}

function destructiveLabel(action: unknown, body: RequestBody) {
  const value = action as Record<string, unknown>;
  const type = String(value.type || '');
  if (type === 'delete_event') {
    const event = findById(body.context?.events, String(value.eventId || ''));
    return `el evento “${String(event?.title || 'seleccionado')}”`;
  }
  if (type === 'delete_reminder') {
    const reminder = findById(body.context?.reminders, String(value.reminderId || ''));
    return `la tarea “${String(reminder?.title || 'seleccionada')}”`;
  }
  if (type === 'delete_sheet_row') {
    const row = findById(body.context?.sheetRows, String(value.rowId || ''));
    return `la fila de Excel “${String(row?.label || 'seleccionada')}”`;
  }
  return 'ese elemento';
}

function destructiveConfirmationMessage(actions: unknown[], body: RequestBody) {
  const labels = actions.map((action) => destructiveLabel(action, body));
  if (labels.length === 1) return `Voy a eliminar ${labels[0]}. ¿Confirmas?`;
  const visible = labels.slice(0, 3).join(', ');
  const extra = labels.length > 3 ? ` y ${labels.length - 3} más` : '';
  return `Voy a eliminar ${visible}${extra}. ¿Confirmas?`;
}

function systemPrompt(body: RequestBody) {
  const context = body.context || {};
  const ui = body.uiContext || {};
  const now = body.now || new Date().toISOString();
  const timezone = body.timezone || 'America/Mexico_City';
  const locale = body.locale || 'es-MX';
  const activeEvent = ui.activeEventId
    ? `${ui.activeEventTitle || 'Evento'} | id=${ui.activeEventId}${ui.activeEventDate ? ` | fecha=${ui.activeEventDate}` : ''}${ui.activeEventVenue ? ` | lugar=${ui.activeEventVenue}` : ''}`
    : 'NINGUNO';

  return `Eres DJ NOA, el asistente privado de una sola persona para organizar eventos, calendario, gastos/Excel y recordatorios. Hablas español natural, breve, cálido y directo. Tu prioridad es entender correctamente antes de actuar.

FECHA/HORA ACTUAL: ${now}
ZONA HORARIA: ${timezone}
LOCALE: ${locale}
PANTALLA ACTUAL: ${ui.view || 'desconocida'}
EVENTO ABIERTO EN PANTALLA: ${activeEvent}

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
{"type":"create_reminder","title":"texto","dueAt":"ISO 8601 opcional","eventId":"ID exacto opcional","eventRef":"created_event opcional","notes":"opcional","priority":"low|normal|high","repeat":"none|daily|weekly|monthly","notificationEnabled":true}
{"type":"update_reminder","reminderId":"ID EXACTO DEL CONTEXTO","title":"opcional","dueAt":"ISO 8601 opcional","eventId":"ID exacto opcional","notes":"opcional","priority":"low|normal|high opcional","repeat":"none|daily|weekly|monthly opcional","notificationEnabled":true,"done":false}
{"type":"delete_reminder","reminderId":"ID EXACTO DEL CONTEXTO"}

EXCEL / GASTOS
{"type":"add_sheet_row","label":"texto","category":"texto","amount":8500,"status":"pending|paid|info","notes":"opcional","eventId":"ID exacto opcional","eventRef":"created_event opcional","calendarDate":"YYYY-MM-DD opcional"}
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
- El contexto de pantalla es información real de la app. Si hay un EVENTO ABIERTO EN PANTALLA y el usuario dice “este evento”, “a este”, “aquí”, “esto”, “agrégale”, “ponle” o una referencia equivalente relacionada con eventos, tareas o gastos, usa ese eventId exacto. No preguntes qué evento es si la referencia encaja claramente con el evento abierto.
- Si el usuario está dentro del evento abierto y pide “agrega 4500 de audio”, crea la fila de Excel con eventId igual al evento abierto y calendarDate igual a su fecha, salvo que el usuario indique otra fecha o diga explícitamente que no pertenece al evento.
- Si dentro del evento abierto pide un recordatorio o tarea y no nombra otro evento, asócialo al eventId abierto. La fecha/hora del recordatorio debe salir de lo que diga el usuario; no inventes una hora.
- Si la pantalla actual es Excel, Tareas o Calendario pero NO hay evento abierto, usa esa pantalla solo para interpretar qué tipo de objeto quiere tocar. No inventes relación con un evento.
- El contexto de pantalla actual tiene prioridad sobre referencias vagas de turnos anteriores; una referencia explícita del usuario a otro elemento tiene prioridad sobre la pantalla.
- Entiende fechas naturales en español, nombres de meses, hoy, mañana, pasado mañana, días de la semana y expresiones relativas usando la fecha actual.
- Entiende cantidades habladas como “8 mil”, “ocho mil”, “8 mil quinientos”, etc. y conviértelas a número.
- Si una orden contiene varias tareas independientes, devuelve todas las acciones necesarias en el orden natural de ejecución.
- ENCADENAMIENTO: si una misma orden crea EXACTAMENTE UN evento nuevo y además incluye tareas/recordatorios o gastos claramente relacionados con ese evento, usa eventRef:"created_event" en esas acciones relacionadas. Nunca inventes un eventId para un evento que todavía no existe.
- Para un gasto relacionado con el evento recién creado, usa eventRef:"created_event" y también calendarDate con la fecha del evento, salvo que el usuario indique otra fecha.
- Para un recordatorio relacionado con el evento recién creado, usa eventRef:"created_event". Si el recordatorio es relativo al evento, calcula dueAt a partir de la fecha indicada, pero no inventes una hora que el usuario no dijo.
- Si la misma orden crea más de un evento, NO uses eventRef:"created_event". Si no queda inequívocamente claro a cuál pertenece una tarea o gasto, pregunta antes y usa none.
- Para modificar, borrar o abrir algo existente, usa SIEMPRE el ID exacto presente en el contexto. Nunca inventes IDs.
- Si hay dos candidatos posibles o no está claro cuál es, pregunta antes y usa none.
- Si falta un dato imprescindible para ejecutar con seguridad (por ejemplo la fecha de un evento nuevo), pregunta antes y usa none. No adivines.
- Para preguntas como “qué tengo hoy”, “cuál es mi próximo evento”, “cuánto tengo pendiente” o “qué tareas tengo”, responde usando el contexto y usa none o query_total.
- BORRADOS: nunca ejecutes un delete_event, delete_reminder o delete_sheet_row en la primera petición de borrado. Primero pregunta confirmación con actions:[{"type":"none"}]. Solo devuelve el delete exacto después de que el usuario confirme claramente en el siguiente turno, o si en el mismo mensaje dice de forma inequívoca que está seguro/que confirma la eliminación.
- Si acabas de preguntar una confirmación de borrado y el usuario responde “sí”, “confirmo”, “adelante”, “hazlo” o equivalente, usa el contexto y el historial para ejecutar exactamente el borrado pendiente; no le pidas que repita el nombre.
- No conviertas “quítalo de la vista”, “ocúltalo” o frases dudosas en borrado.
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

    const destructiveActions = parsed.actions.filter(isDeleteAction);
    if (destructiveActions.length && !deleteIsConfirmed(text, body)) {
      return json({
        reply: destructiveConfirmationMessage(destructiveActions, body),
        actions: [{ type: 'none' }]
      });
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
