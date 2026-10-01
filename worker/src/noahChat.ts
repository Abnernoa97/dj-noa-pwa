type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = { AI: AiBinding };
type ChatTurn = { role?: string; content?: string };
type EventSnapshot = Record<string, unknown>;
type SheetSnapshot = Record<string, unknown>;
type SheetColumnSnapshot = Record<string, unknown>;
type ChatAction = Record<string, unknown>;
type NavigableSection = 'home' | 'events' | 'calendar' | 'sheet' | 'reminders';
type ActionSurface = 'events' | 'calendar' | 'sheet';
type CurrencyCode = 'MXN' | 'USD';
type SheetColumnBehavior = 'income' | 'expense' | 'investment' | 'neutral';

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
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9$]+/g, ' ').trim();
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

function cleanSheetStatus(value: unknown) {
  return value === 'pending' || value === 'paid' || value === 'info' ? value : undefined;
}

function cleanFinancialType(value: unknown) {
  return value === 'income' || value === 'expense' || value === 'neutral' ? value : undefined;
}

function cleanColumnBehavior(value: unknown): SheetColumnBehavior | undefined {
  return value === 'income' || value === 'expense' || value === 'investment' || value === 'neutral' ? value : undefined;
}

function cleanColumnType(value: unknown) {
  return value === 'text' || value === 'number' || value === 'currency' || value === 'date' || value === 'formula' ? value : undefined;
}

function cleanCurrency(value: unknown): CurrencyCode | undefined {
  const text = String(value || '').trim().toUpperCase();
  return text === 'MXN' || text === 'USD' ? text : undefined;
}

function cleanAmount(value: unknown) {
  const number = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) && Math.abs(number) <= 1_000_000_000 ? Math.abs(number) : undefined;
}

function cleanSheetValue(value: unknown): string | number | boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1_000_000_000 ? value : undefined;
  if (typeof value === 'string') return value.trim().slice(0, 900);
  return undefined;
}

function cleanSurface(value: unknown): ActionSurface | undefined {
  return value === 'events' || value === 'calendar' || value === 'sheet' ? value : undefined;
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

function sanitizeFinance(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const amount = cleanAmount(value.amount);
  const currency = cleanCurrency(value.currency);
  if (amount === undefined || !currency) return undefined;
  return {
    amount,
    currency,
    label: cleanString(value.label, 180),
    category: cleanString(value.category, 120),
    status: cleanSheetStatus(value.status),
    financialType: cleanFinancialType(value.financialType),
    notes: cleanString(value.notes, 500),
    description: cleanString(value.description, 500)
  };
}

function cleanSection(value: unknown): NavigableSection | undefined {
  return value === 'home' || value === 'events' || value === 'calendar' || value === 'sheet' || value === 'reminders' ? value : undefined;
}

function cleanWeekdays(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6))].sort((a, b) => a - b);
}

function validSeriesRange(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
  return end - start <= 732 * 24 * 60 * 60 * 1000;
}

function sanitizeActions(raw: unknown, eventIds: Set<string>, rowIds: Set<string>, columnIds: Set<string>) {
  if (!Array.isArray(raw)) return [];
  const actions: ChatAction[] = [];
  for (const item of raw.slice(0, 30)) {
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

    if (type === 'create_sheet_column') {
      const name = cleanString(action.name, 120);
      if (!name) continue;
      actions.push({ type, name, behavior: cleanColumnBehavior(action.behavior) || 'neutral' });
      continue;
    }

    if (type === 'update_sheet_column') {
      const columnId = cleanString(action.columnId, 120);
      if (!columnId || !columnIds.has(columnId)) continue;
      const name = cleanString(action.name, 120);
      const behavior = cleanColumnBehavior(action.behavior);
      if (!name && !behavior) continue;
      actions.push({ type, columnId, ...(name ? { name } : {}), ...(behavior ? { behavior } : {}) });
      continue;
    }

    if (type === 'delete_sheet_column') {
      const columnId = cleanString(action.columnId, 120);
      if (columnId && columnIds.has(columnId)) actions.push({ type, columnId });
      continue;
    }

    if (type === 'create_sheet_grid_row') {
      const label = cleanString(action.label, 180);
      if (!label) continue;
      const cells: Array<{ columnId: string; value: string | number | boolean | null }> = [];
      if (Array.isArray(action.cells)) {
        for (const rawCell of action.cells.slice(0, 80)) {
          if (!rawCell || typeof rawCell !== 'object') continue;
          const cell = rawCell as Record<string, unknown>;
          const columnId = cleanString(cell.columnId, 120);
          if (!columnId || !columnIds.has(columnId)) continue;
          const value = cleanSheetValue(cell.value);
          if (value === undefined) continue;
          cells.push({ columnId, value });
        }
      }
      actions.push({ type, label, cells });
      continue;
    }

    if (type === 'rename_sheet_row') {
      const rowId = cleanString(action.rowId, 120);
      const label = cleanString(action.label, 180);
      if (rowId && rowIds.has(rowId) && label) actions.push({ type, rowId, label });
      continue;
    }

    if (type === 'set_sheet_cell') {
      const rowId = cleanString(action.rowId, 120);
      const columnId = cleanString(action.columnId, 120);
      const value = cleanSheetValue(action.value);
      if (rowId && rowIds.has(rowId) && columnId && columnIds.has(columnId) && value !== undefined) {
        actions.push({ type, rowId, columnId, value });
      }
      continue;
    }

    if (type === 'clear_sheet_cell') {
      const rowId = cleanString(action.rowId, 120);
      const columnId = cleanString(action.columnId, 120);
      if (rowId && rowIds.has(rowId) && columnId && columnIds.has(columnId)) actions.push({ type, rowId, columnId });
      continue;
    }

    if (type === 'delete_sheet_row') {
      const rowId = cleanString(action.rowId, 120);
      if (rowId && rowIds.has(rowId)) actions.push({ type, rowId });
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
      const surface = cleanSurface(action.surface);
      const finance = sanitizeFinance(action.finance);
      const result: ChatAction = { type, event: cleanEvent, surface: surface === 'events' ? 'events' : 'calendar' };
      if (finance) result.finance = finance;
      actions.push(result);
      continue;
    }

    if (type === 'create_calendar_series') {
      const event = action.event && typeof action.event === 'object' ? action.event as Record<string, unknown> : {};
      const title = cleanString(event.title, 180);
      const startDate = cleanDate(action.startDate);
      const endDate = cleanDate(action.endDate);
      const weekdays = cleanWeekdays(action.weekdays);
      if (!title || !startDate || !endDate || !weekdays.length || !validSeriesRange(startDate, endDate)) continue;
      const cleanEvent = sanitizePatch(event);
      delete cleanEvent.date;
      cleanEvent.title = title;
      if (!cleanEvent.status) cleanEvent.status = 'confirmed';
      const finance = sanitizeFinance(action.finance);
      const result: ChatAction = { type, event: cleanEvent, startDate, endDate, weekdays };
      if (finance) result.finance = finance;
      actions.push(result);
      continue;
    }

    if (type === 'create_sheet_row') {
      const row = sanitizeFinance(action.row);
      if (!row) continue;
      const rawRow = action.row && typeof action.row === 'object' ? action.row as Record<string, unknown> : {};
      const calendarDate = cleanDate(rawRow.calendarDate);
      const surface = cleanSurface(action.surface);
      actions.push({ type, row: { ...row, calendarDate }, surface: surface || 'sheet' });
      continue;
    }

    const eventId = cleanString(action.eventId, 120);
    if (!eventId || !eventIds.has(eventId)) continue;

    if (type === 'sync_event_finance') {
      const finance = sanitizeFinance(action.finance);
      if (!finance) continue;
      const surface = cleanSurface(action.surface);
      actions.push({ type, eventId, finance, surface: surface || 'sheet' });
      continue;
    }

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
  const transition = '(?:pasemos|pasamos|pasar|vamos|vayamos|ve|abre|abrir|cambia|cambiemos|cambiar|ir|vamonos|llevame|quiero ir)';
  const matches = (term: string) => new RegExp(`${transition}\\s+(?:a\\s+|al\\s+|la\\s+)?${term}\\b`).test(clean);

  if (matches('calendario')) return { section: 'calendar', reply: 'Perfecto, pasamos a Calendario.' };
  if (matches('eventos?')) return { section: 'events', reply: 'Perfecto, pasamos a Eventos.' };
  if (matches('excel') || matches('tabla')) return { section: 'sheet', reply: 'Perfecto, pasamos a Excel.' };
  if (matches('tareas?') || matches('recordatorios?')) return { section: 'reminders', reply: 'Perfecto, pasamos a Tareas.' };
  if (matches('inicio') || matches('home')) return { section: 'home', reply: 'Perfecto, volvemos a Inicio.' };
  return null;
}

function mutationIntent(text: string) {
  const clean = normalize(text);
  return /\b(crea|crear|creame|hacer|haz|agrega|anade|añade|pon|ponle|escribe|anota|programa|programar|agenda|agendar|cada|todos|todas|edita|editar|cambia|cambiar|renombra|modifica|actualiza|mueve|reprograma|borra|borrar|elimina|eliminar|quita|quitar|limpia|limpiar|vacia|vaciar|columna|fila|celda|pesos?|mxn|dolares?|usd|cobra|cobro|cuesta|precio|pago|pagado|ingreso|gasto|inversion|excel|tabla)\b/i.test(clean) || /\$\s*\d/.test(text);
}

function pureNavigationOnly(text: string) {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  return words.length <= 6 && !mutationIntent(text) && !/\b(que|cual|cuando|dime|revisa|busca|tengo|hay|evento|eventos)\b/i.test(normalize(text));
}

function systemPrompt(contextText: string) {
  return `Eres Noah, el asistente personal de voz de DJ NOA. Hablas español de México como una persona: natural, continuo, breve y sin frases robóticas. Tu trabajo es entender la intención COMPLETA y convertirla en todas las acciones necesarias en un solo turno.

CONTEXTO ACTUAL EN TIEMPO REAL:
${contextText}

ARQUITECTURA MENTAL:
- CALENDARIO es la matriz visual central.
- EVENTOS contiene la ficha operativa del mismo evento.
- EXCEL es una hoja clásica personalizada por el usuario.
- Una misma frase puede requerir varias acciones. No la cortes al detectar una sección.

REGLA ABSOLUTA DE EXCEL EN TIEMPO REAL:
- CURRENT_SHEET_COLUMNS es la estructura REAL y ACTUAL de la tabla, leída de IndexedDB justo antes de esta petición.
- CURRENT_SHEET_ROWS son las filas REALES y ACTUALES. Cada fila incluye cells con columnId, columnName y value de las celdas que tienen contenido.
- Antes de responder o ejecutar CUALQUIER cosa relacionada con Excel, mira CURRENT_SHEET_COLUMNS y CURRENT_SHEET_ROWS.
- Los nombres de columnas pueden ser CUALQUIER palabra: “Perro”, “Árbol”, “Sombrero”, “XYZ”, etc. No necesitan tener significado financiero.
- Si el usuario dice “en Perro”, busca primero una columna existente cuyo name coincida con Perro ignorando mayúsculas, acentos y pequeñas variaciones obvias. Luego usa EXACTAMENTE su id real como columnId.
- Nunca inventes columnId ni rowId. Solo usa IDs presentes en el contexto actual.
- Si una columna fue renombrada, usa SIEMPRE el nombre nuevo que aparece en CURRENT_SHEET_COLUMNS. No dependas de memoria anterior.
- behavior define la matemática real de una columna: income=suma, expense=resta, investment=resta como inversión, neutral=no calcula. No cambies behavior salvo que el usuario lo pida.
- Una palabra arbitraria como “Perro” NO significa gasto, ingreso ni nada por sí sola. Su behavior actual manda.

CONTROL DE LA HOJA:
- create_sheet_column: crea una nueva columna. Si el usuario no especifica qué representa, behavior="neutral".
- update_sheet_column: renombra una columna o cambia su behavior usando su columnId existente.
- delete_sheet_column: elimina una columna existente; la app pedirá confirmación.
- create_sheet_grid_row: crea una fila nueva y puede rellenar varias columnas en la misma acción.
- set_sheet_cell: cambia UNA celda existente usando rowId + columnId.
- clear_sheet_cell: vacía una celda existente.
- rename_sheet_row: cambia el Concepto/nombre de una fila.
- delete_sheet_row: elimina una fila; la app pedirá confirmación.
- Si el usuario pide “agrega Hotel con 10 en Perro”, crea una fila Hotel y usa el columnId real de Perro.
- Si dice “en la fila Hotel pon 20 en Sombrero”, localiza la fila Hotel y la columna Sombrero, y usa set_sheet_cell.
- Si dice solo “pon 20 en Sombrero” y hay varias filas posibles sin contexto suficiente, pregunta EN QUÉ FILA; no inventes una.
- Si la petición nombra una columna que NO existe, no la crees a menos que el usuario esté pidiendo crearla. Pregunta o aclara.
- Para leer/consultar datos de Excel, responde usando CURRENT_SHEET_COLUMNS/CURRENT_SHEET_ROWS y devuelve cero acciones.
- Cuando el usuario esté en otra sección y pida una modificación de Excel que quiere ver, puedes anteponer navigate_section a sheet y luego ejecutar la acción.

HERRAMIENTAS GENERALES:
- EVENTOS: leer, crear, editar, borrar y abrir eventos usando CURRENT_EVENTS.
- CALENDARIO: mostrar eventos y crear series recurrentes por rango y días de semana.
- EXCEL FINANCIERO LEGADO: create_sheet_row y sync_event_finance siguen disponibles para montos vinculados a eventos.
- NAVEGACIÓN: Inicio, Eventos, Calendario, Excel y Tareas.

REGLAS CRÍTICAS:
1. Escucha la frase COMPLETA antes de decidir.
2. Si una frase contiene varias instrucciones, devuelve TODAS las acciones necesarias en orden.
3. Pregunta únicamente si falta un dato realmente imprescindible o hay ambigüedad real.
4. Nunca obligues al usuario a repetir datos que ya dijo en el mismo turno o en HISTORY.
5. Nunca afirmes que una acción se hizo si no incluyes la acción correspondiente.
6. Solo una respuesta hablada breve al final; no narres cada paso.

DINERO Y MONEDA:
- “50 mil pesos”, “50,000 MXN”, “$50,000” en contexto mexicano => amount 50000, currency MXN.
- “50 mil dólares”, “50,000 USD”, “50 thousand dollars” => amount 50000, currency USD.
- Si la cifra forma parte del NOMBRE, por ejemplo “Evento de 50 mil”, y NO dice pesos/dólares/MXN/USD ni habla de precio/cobro/pago/ingreso/gasto, NO la conviertas en Excel financiero.
- amount siempre es número, no texto.
- Para eventos cobrados/contratados usa financialType="income" por defecto salvo que el usuario indique gasto.
- status financiero por defecto="pending", salvo que diga pagado/cobrado.

REGLAS DE CALENDARIO:
- weekday JavaScript: domingo=0, lunes=1, martes=2, miércoles=3, jueves=4, viernes=5, sábado=6.
- “todos los viernes, sábado y domingo de 2027” => startDate 2027-01-01, endDate 2027-12-31, weekdays [0,5,6].
- Para recurrencias devuelve UNA sola create_calendar_series, nunca decenas de create_event.
- Si la recurrencia tiene un monto explícito, adjunta finance y la app creará un Excel vinculado por cada evento generado.

REGLAS DE EVENTOS EXISTENTES:
- Nunca inventes eventId. Para update/delete/open/sync_event_finance usa EXACTAMENTE un id de CURRENT_EVENTS.
- Si cambia la fecha de un evento, update_event moverá también sus vínculos en Calendario/Excel.
- Si hay dos eventos posibles y no puedes distinguir, pregunta cuál y devuelve cero acciones.
- Fechas YYYY-MM-DD y horas HH:mm 24h usando CURRENT_LOCAL_DATETIME.

EJEMPLO EXCEL 1:
CURRENT_SHEET_COLUMNS contiene {"id":"col-perro","name":"Perro","behavior":"neutral"}.
Usuario: “Agrega Hotel y en Perro pon Reservado.”
Respuesta: {"reply":"Listo, lo agrego.","eventActions":[{"type":"navigate_section","section":"sheet"},{"type":"create_sheet_grid_row","label":"Hotel","cells":[{"columnId":"col-perro","value":"Reservado"}]}]}

EJEMPLO EXCEL 2:
CURRENT_SHEET_ROWS contiene {"id":"row-hotel","label":"Hotel"} y CURRENT_SHEET_COLUMNS contiene {"id":"col-sombrero","name":"Sombrero"}.
Usuario: “En Hotel pon 250 en Sombrero.”
Respuesta: {"reply":"Listo.","eventActions":[{"type":"set_sheet_cell","rowId":"row-hotel","columnId":"col-sombrero","value":250}]}

EJEMPLO EXCEL 3:
Usuario: “Crea una columna que se llame Transporte y que sea gasto.”
Respuesta: {"reply":"Listo, creo Transporte como gasto.","eventActions":[{"type":"navigate_section","section":"sheet"},{"type":"create_sheet_column","name":"Transporte","behavior":"expense"}]}

EJEMPLO EVENTO:
Usuario: “El 27 de noviembre de 2027 tengo una boda en San Miguel por 50 mil pesos y quiero verla en calendario.”
Respuesta: {"reply":"Listo, lo dejo sincronizado.","eventActions":[{"type":"create_event","surface":"calendar","event":{"title":"Boda en San Miguel","date":"2027-11-27","status":"confirmed"},"finance":{"amount":50000,"currency":"MXN","label":"Boda en San Miguel","category":"Evento","status":"pending","financialType":"income"}}]}

RESPONDE SOLO JSON VÁLIDO, sin markdown:
{"reply":"una sola frase breve","eventActions":[]}

Acciones permitidas:
{"type":"navigate_section","section":"home|events|calendar|sheet|reminders"}
{"type":"create_sheet_column","name":"Perro","behavior":"income|expense|investment|neutral"}
{"type":"update_sheet_column","columnId":"id existente","name":"nuevo nombre","behavior":"income|expense|investment|neutral"}
{"type":"delete_sheet_column","columnId":"id existente"}
{"type":"create_sheet_grid_row","label":"Hotel","cells":[{"columnId":"id existente","value":"texto o número"}]}
{"type":"rename_sheet_row","rowId":"id existente","label":"nuevo concepto"}
{"type":"set_sheet_cell","rowId":"id existente","columnId":"id existente","value":"texto o número"}
{"type":"clear_sheet_cell","rowId":"id existente","columnId":"id existente"}
{"type":"delete_sheet_row","rowId":"id existente"}
{"type":"open_events"}
{"type":"open_event","eventId":"id existente"}
{"type":"create_event","surface":"events|calendar","event":{"title":"...","date":"YYYY-MM-DD","showTime":"HH:mm","venue":"...","status":"confirmed"},"finance":{"amount":50000,"currency":"MXN","label":"...","category":"Evento","status":"pending","financialType":"income"}}
{"type":"create_calendar_series","event":{"title":"...","showTime":"HH:mm","venue":"...","status":"confirmed"},"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","weekdays":[0,5,6],"finance":{"amount":50000,"currency":"MXN","category":"Evento","status":"pending","financialType":"income"}}
{"type":"sync_event_finance","eventId":"id existente","surface":"events|calendar|sheet","finance":{"amount":8000,"currency":"USD","status":"pending","financialType":"income"}}
{"type":"create_sheet_row","surface":"sheet","row":{"amount":1200,"currency":"USD","label":"Hotel","category":"Gasto","status":"pending","financialType":"expense","calendarDate":"YYYY-MM-DD"}}
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
          max_completion_tokens: 1800,
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
    { messages, temperature: 0.05, max_tokens: 900 },
    { rejectIfBusy: false }
  );
}

export async function handleNoahChat(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await request.json() as {
      message?: string;
      history?: ChatTurn[];
      context?: {
        section?: string;
        localDateTime?: string;
        timezoneOffsetMinutes?: number;
        events?: EventSnapshot[];
        sheetColumns?: SheetColumnSnapshot[];
        sheetRows?: SheetSnapshot[];
      };
    };
    const message = String(body?.message || '').trim().slice(0, 2000);
    if (!message) return json({ error: 'message_required' }, 400);

    const directNavigation = navigationIntent(message);
    if (directNavigation && pureNavigationOnly(message)) {
      return json({
        text: directNavigation.reply,
        eventActions: [{ type: 'navigate_section', section: directNavigation.section }]
      });
    }

    const events = Array.isArray(body.context?.events)
      ? body.context!.events!.slice(0, 120).map((event) => ({
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

    const sheetColumns = Array.isArray(body.context?.sheetColumns)
      ? body.context!.sheetColumns!.slice(0, 80).map((column) => ({
          id: cleanString(column.id, 120),
          name: cleanString(column.name, 120),
          key: cleanString(column.key, 160),
          type: cleanColumnType(column.type) || 'text',
          behavior: cleanColumnBehavior(column.behavior) || 'neutral',
          position: Number.isFinite(Number(column.position)) ? Number(column.position) : 0
        })).filter((column) => column.id && column.name && column.key)
      : [];

    const columnIds = new Set(sheetColumns.map((column) => String(column.id)));
    const columnById = new Map(sheetColumns.map((column) => [String(column.id), column]));

    const sheetRows = Array.isArray(body.context?.sheetRows)
      ? body.context!.sheetRows!.slice(0, 120).map((row) => {
          const cells: Array<{ columnId: string; columnName: string; value: string | number | boolean | null }> = [];
          if (Array.isArray(row.cells)) {
            for (const rawCell of row.cells.slice(0, 80)) {
              if (!rawCell || typeof rawCell !== 'object') continue;
              const cell = rawCell as Record<string, unknown>;
              const columnId = cleanString(cell.columnId, 120);
              if (!columnId || !columnIds.has(columnId)) continue;
              const value = cleanSheetValue(cell.value);
              if (value === undefined) continue;
              const column = columnById.get(columnId);
              cells.push({ columnId, columnName: String(column?.name || ''), value });
            }
          }
          return {
            id: cleanString(row.id, 120),
            label: cleanString(row.label, 180),
            category: cleanString(row.category, 120),
            amount: cleanAmount(row.amount),
            currency: cleanCurrency(row.currency) || 'MXN',
            status: cleanSheetStatus(row.status),
            financialType: cleanFinancialType(row.financialType),
            eventId: cleanString(row.eventId, 120),
            calendarDate: cleanDate(row.calendarDate),
            notes: cleanString(row.notes, 400),
            description: cleanString(row.description, 400),
            cells
          };
        }).filter((row) => row.id && row.label)
      : [];

    const eventIds = new Set(events.map((event) => String(event.id)));
    const rowIds = new Set(sheetRows.map((row) => String(row.id)));
    const contextText = JSON.stringify({
      CURRENT_LOCAL_DATETIME: cleanString(body.context?.localDateTime, 100) || new Date().toISOString(),
      TIMEZONE_OFFSET_MINUTES: Number(body.context?.timezoneOffsetMinutes || 0),
      CURRENT_SECTION: cleanString(body.context?.section, 40) || 'unknown',
      CURRENT_EVENTS: events,
      CURRENT_SHEET_COLUMNS: sheetColumns,
      CURRENT_SHEET_ROWS: sheetRows
    });

    const history = Array.isArray(body.history)
      ? body.history.slice(-16).map((item) => ({
          role: item?.role === 'assistant' ? 'assistant' : 'user',
          content: String(item?.content || '').trim().slice(0, 1100)
        })).filter((item) => item.content)
      : [];

    const messages = [
      { role: 'system', content: systemPrompt(contextText) },
      ...history,
      { role: 'user', content: message }
    ];

    const reliable = mutationIntent(message) || body.context?.section === 'sheet';
    const result = await runModel(env, messages, reliable);
    const raw = readText(result);
    const parsed = parseJsonObject(raw);

    if (!parsed) {
      const text = raw.replace(/```(?:json)?|```/gi, '').trim().slice(0, 500);
      return json({ text: text || 'No entendí bien. Dímelo otra vez.', eventActions: [] });
    }

    const reply = cleanString(parsed.reply, 420) || 'Listo.';
    const eventActions = sanitizeActions(parsed.eventActions, eventIds, rowIds, columnIds);
    return json({ text: reply, eventActions });
  } catch (error) {
    console.error('Noah chat failed', error);
    return json({ error: 'chat_unavailable' }, 503);
  }
}