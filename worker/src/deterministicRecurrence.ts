type AssistantPayload = {
  reply?: string;
  actions?: Array<Record<string, unknown>>;
};

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
};

const WEEKDAYS: Array<[RegExp, number]> = [
  [/\bdomingos?\b/i, 0],
  [/\blunes\b/i, 1],
  [/\bmartes\b/i, 2],
  [/\bmi[eé]rcoles\b/i, 3],
  [/\bjueves\b/i, 4],
  [/\bviernes\b/i, 5],
  [/\bs[aá]bados?\b/i, 6]
];

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function recurrenceSpec(command: string) {
  const normalized = normalize(command);
  if (!/\b(todos?|todas?|cada|fines? de semana|viernes|sabados?|domingos?|lunes|martes|miercoles|jueves)\b/.test(normalized)) return null;

  let month: number | null = null;
  for (const [name, index] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(normalized)) {
      month = index;
      break;
    }
  }
  if (month === null) return null;

  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);

  const weekdays = new Set<number>();
  for (const [pattern, day] of WEEKDAYS) if (pattern.test(command)) weekdays.add(day);
  if (!weekdays.size && /\bfines? de semana\b/i.test(command)) {
    weekdays.add(5);
    weekdays.add(6);
  }
  if (!weekdays.size) return null;

  return { year, month, weekdays: [...weekdays] };
}

function datesForMonth(year: number, month: number, weekdays: number[]) {
  const wanted = new Set(weekdays);
  const dates: string[] = [];
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(Date.UTC(year, month, day));
    if (wanted.has(date.getUTCDay())) dates.push(isoDate(year, month, day));
  }
  return dates;
}

function actionDate(action: Record<string, unknown>) {
  return typeof action.date === 'string' ? action.date : '';
}

export function expandDeterministicRecurrence(command: string, payload: AssistantPayload): AssistantPayload {
  const spec = recurrenceSpec(command);
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  if (!spec || !actions.length) return payload;

  const eventActions = actions.filter((action) => action?.type === 'create_event');
  if (!eventActions.length) return payload;

  const monthPrefix = `${spec.year}-${String(spec.month + 1).padStart(2, '0')}-`;
  const inMonth = eventActions.filter((action) => actionDate(action).startsWith(monthPrefix));
  const template = inMonth[0] || eventActions[0];
  if (!String(template.title || '').trim()) return payload;

  const generated = datesForMonth(spec.year, spec.month, spec.weekdays).map((date) => ({ ...template, date }));
  if (!generated.length) return payload;

  const recurringEventSet = new Set(inMonth);
  const result: Array<Record<string, unknown>> = [];
  let inserted = false;

  for (const action of actions) {
    if (recurringEventSet.has(action)) {
      if (!inserted) {
        result.push(...generated);
        inserted = true;
      }
      continue;
    }
    result.push(action);
  }
  if (!inserted) result.unshift(...generated);

  const seen = new Set<string>();
  const deduped = result.filter((action) => {
    if (action.type !== 'create_event') return true;
    const key = `${String(action.title || '')}|${String(action.date || '')}|${String(action.time || '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ...payload,
    reply: payload.reply || `Listo. Preparé ${generated.length} fechas recurrentes.`,
    actions: deduped
  };
}
