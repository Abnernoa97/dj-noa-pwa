import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, addWeeks, format, isAfter, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import CalendarWorkspace from './CalendarWorkspace';
import { EventEditor, EventHub, EventsView, type EventDraft } from './EventWorkspace';
import MlbWorkspace from './MlbWorkspace';
import NoahActionOverlay from './NoahActionOverlay';
import NoahImageIntake from './NoahImageIntake';
import NoahVoice, { type NoahVoiceHandle } from './NoahVoice';
import { executeNoahSheetAction, isNoahSheetAction, type NoahChatAction } from './noahExcel';
import ReminderWorkspace from './ReminderWorkspace';
import SheetWorkspace from './SheetWorkspace';
import { db, uid } from './db';
import { scheduleReminderNotifications } from './reminderNotifications';
import type { AppView, EventItem, ReminderItem, SheetRow } from './types';
import {
  eventActionLabel,
  sectionName,
  type NoahActionActivity,
  type NoahActionStep,
  type NoahEventAction,
  type NoahEventActionResult,
  type NoahEventPatch,
  type NoahFinanceInput
} from './noahEvents';
import BottomNav from './app/BottomNav';
import HomeView from './app/HomeView';

function safeDate(value?: string) {
  if (!value) return null;
  try { return parseISO(value); } catch { return null; }
}

function nextReminderDate(dueAt: string, repeat: ReminderItem['repeat']) {
  const current = parseISO(dueAt);
  const next = repeat === 'daily' ? addDays(current, 1) : repeat === 'weekly' ? addWeeks(current, 1) : repeat === 'monthly' ? addMonths(current, 1) : current;
  return next.toISOString();
}

function sortEvents(items: EventItem[]) {
  return [...items].sort((a, b) => `${a.date}T${a.showTime || a.time || '00:00'}`.localeCompare(`${b.date}T${b.showTime || b.time || '00:00'}`));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function normalizedEventTitle(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function financeText(finance: NoahFinanceInput) {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: finance.currency,
      maximumFractionDigits: 0
    }).format(finance.amount);
  } catch {
    return `${finance.amount} ${finance.currency}`;
  }
}

const fieldLabels: Partial<Record<keyof NoahEventPatch, string>> = {
  title: 'Nombre',
  date: 'Fecha',
  callTime: 'Llamada',
  soundcheckTime: 'Prueba de sonido',
  showTime: 'Show',
  venue: 'Venue',
  address: 'Dirección',
  details: 'Detalles',
  dressCode: 'Vestuario',
  contactName: 'Contacto',
  contactPhone: 'Teléfono',
  mapUrl: 'Google Maps',
  notes: 'Notas',
  status: 'Estado'
};

function fieldValue(key: keyof NoahEventPatch, value: unknown) {
  if (key === 'status') return value === 'confirmed' ? 'Confirmado' : value === 'tentative' ? 'Por confirmar' : value === 'done' ? 'Terminado' : '';
  return String(value ?? '').trim();
}

function patchEntries(patch: NoahEventPatch) {
  return (Object.entries(patch) as Array<[keyof NoahEventPatch, unknown]>)
    .filter(([key]) => key !== 'time')
    .filter(([key]) => Boolean(fieldLabels[key]));
}

function progressSteps(entries: Array<[keyof NoahEventPatch, unknown]>, prefix: string, activeIndex: number, complete = false): NoahActionStep[] {
  return [
    { id: `${prefix}-open`, label: prefix === 'create' ? 'Preparando ficha' : 'Abriendo ficha', state: complete || activeIndex > 0 ? 'done' : 'active' },
    ...entries.map(([key, value], index) => ({
      id: `${prefix}-${String(key)}`,
      label: fieldLabels[key] || String(key),
      value: fieldValue(key, value),
      state: complete || index + 1 < activeIndex ? 'done' : index + 1 === activeIndex ? 'active' : 'pending'
    } as NoahActionStep)),
    { id: `${prefix}-save`, label: 'Guardando cambios', state: complete ? 'done' : activeIndex > entries.length ? 'active' : 'pending' }
  ];
}

function matrixSteps(title: string, date: string, finance: NoahFinanceInput | undefined, stage: number, complete = false): NoahActionStep[] {
  const steps: NoahActionStep[] = [
    { id: 'matrix-calendar', label: 'Calendario', value: date, state: complete || stage > 0 ? 'done' : 'active' },
    { id: 'matrix-event', label: 'Evento', value: title, state: complete || stage > 1 ? 'done' : stage === 1 ? 'active' : 'pending' }
  ];
  if (finance) {
    steps.push({
      id: 'matrix-excel',
      label: 'Excel',
      value: financeText(finance),
      state: complete || stage > 2 ? 'done' : stage === 2 ? 'active' : 'pending'
    });
  }
  steps.push({
    id: 'matrix-link',
    label: 'Sincronizando todo',
    state: complete ? 'done' : stage > (finance ? 2 : 1) ? 'active' : 'pending'
  });
  return steps;
}

function calendarSeriesSteps(created: number, total: number, monthLabel: string, finance?: NoahFinanceInput, complete = false): NoahActionStep[] {
  const steps: NoahActionStep[] = [
    { id: 'series-pattern', label: 'Patrón entendido', state: 'done' },
    { id: 'series-calendar', label: 'Calendario abierto', state: 'done' },
    {
      id: 'series-write',
      label: complete ? 'Fechas creadas' : 'Agregando fechas',
      value: complete ? `${created}` : `${monthLabel} · ${created}/${total}`,
      state: complete ? 'done' : 'active'
    }
  ];
  if (finance) {
    steps.push({
      id: 'series-excel',
      label: 'Excel vinculado',
      value: complete ? `${created} movimientos` : financeText(finance),
      state: complete ? 'done' : created > 0 ? 'active' : 'pending'
    });
  }
  steps.push({ id: 'series-save', label: 'Sincronizando serie', state: complete ? 'done' : 'pending' });
  return steps;
}

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [mlbOpen, setMlbOpen] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventCreateDate, setEventCreateDate] = useState<string | null>(null);
  const [eventHubId, setEventHubId] = useState<string | null>(null);
  const [selectedSheetRowId, setSelectedSheetRowId] = useState<string | null>(null);
  const [noahActivity, setNoahActivity] = useState<NoahActionActivity | null>(null);
  const [noahCalendarDates, setNoahCalendarDates] = useState<string[]>([]);
  const noahRef = useRef<NoahVoiceHandle>(null);
  const noahActivityTimerRef = useRef<number | null>(null);

  const refresh = async () => {
    const [eventData, reminderData, sheetData] = await Promise.all([
      db.events.orderBy('date').toArray(),
      db.reminders.orderBy('createdAt').reverse().toArray(),
      db.sheetRows.orderBy('createdAt').reverse().toArray()
    ]);
    setEvents(eventData);
    setReminders(reminderData);
    setSheetRows(sheetData);
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => scheduleReminderNotifications(reminders), [reminders]);
  useEffect(() => () => {
    if (noahActivityTimerRef.current !== null) window.clearTimeout(noahActivityTimerRef.current);
  }, []);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.find((event) => {
      const date = safeDate(event.date);
      return date && (isSameDay(date, today) || isAfter(date, today));
    });
  }, [events]);

  const total = useMemo(() => sheetRows.filter((row) => (row.currency || 'MXN') === 'MXN').reduce((sum, row) => sum + Number(row.amount || 0), 0), [sheetRows]);
  const openReminders = reminders.filter((item) => !item.done).length;
  const focusReminders = useMemo(() => reminders.filter((item) => !item.done).sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')).slice(0, 3), [reminders]);
  const todayEventCount = useMemo(() => events.filter((item) => item.date === format(new Date(), 'yyyy-MM-dd')).length, [events]);
  const hubEvent = eventHubId ? events.find((item) => item.id === eventHubId) || null : null;

  const startNoah = () => noahRef.current?.start();

  const showNoahActivity = (activity: NoahActionActivity) => {
    if (noahActivityTimerRef.current !== null) window.clearTimeout(noahActivityTimerRef.current);
    noahActivityTimerRef.current = null;
    setNoahActivity(activity);
    if (activity.phase !== 'working') {
      noahActivityTimerRef.current = window.setTimeout(() => {
        setNoahActivity(null);
        setNoahCalendarDates([]);
        noahActivityTimerRef.current = null;
      }, 1650);
    }
  };

  const openEventHub = (event: EventItem) => {
    setEventHubId(event.id);
    setEventEditorOpen(false);
    setSelectedEvent(null);
  };

  const openEventEditor = (event?: EventItem, createDate?: string) => {
    setSelectedEvent(event || null);
    setEventCreateDate(event ? null : createDate || null);
    setEventEditorOpen(true);
  };

  const financeRowData = (event: EventItem, finance: NoahFinanceInput, existing?: SheetRow) => ({
    label: finance.label || event.title,
    category: finance.category || 'Evento',
    amount: finance.amount,
    currency: finance.currency,
    status: finance.status || 'pending' as const,
    financialType: finance.financialType || 'income' as const,
    eventId: event.id,
    calendarDate: event.date,
    notes: finance.notes ?? existing?.notes,
    description: finance.description ?? existing?.description,
    values: existing?.values || {},
    updatedAt: new Date().toISOString()
  });

  const syncFinanceForEvent = async (event: EventItem, finance: NoahFinanceInput) => {
    const existing = sheetRows.find((row) => row.eventId === event.id && row.financialType !== 'neutral') || sheetRows.find((row) => row.eventId === event.id);
    if (existing) {
      const patch = financeRowData(event, finance, existing);
      await db.sheetRows.update(existing.id, patch);
      const updated = { ...existing, ...patch } as SheetRow;
      setSheetRows((current) => current.map((row) => row.id === existing.id ? updated : row));
      return updated;
    }

    const now = new Date().toISOString();
    const row: SheetRow = {
      id: uid(),
      ...financeRowData(event, finance),
      createdAt: now
    };
    await db.sheetRows.add(row);
    setSheetRows((current) => [row, ...current]);
    return row;
  };

  const deleteEventWithRelations = async (eventId: string) => {
    const event = await db.events.get(eventId);
    const now = new Date().toISOString();
    await db.transaction('rw', [db.events, db.eventPhotos, db.reminders, db.sheetRows], async () => {
      await db.eventPhotos.where('eventId').equals(eventId).delete();
      const linkedReminders = await db.reminders.where('eventId').equals(eventId).toArray();
      const linkedRows = await db.sheetRows.where('eventId').equals(eventId).toArray();
      await Promise.all(linkedReminders.map((item) => db.reminders.update(item.id, { eventId: undefined, updatedAt: now })));
      await Promise.all(linkedRows.map((row) => db.sheetRows.update(row.id, { eventId: undefined, calendarDate: row.calendarDate || event?.date, updatedAt: now })));
      await db.events.delete(eventId);
    });
    setEvents((current) => current.filter((item) => item.id !== eventId));
    setReminders((current) => current.map((item) => item.eventId === eventId ? { ...item, eventId: undefined, updatedAt: now } : item));
    setSheetRows((current) => current.map((row) => row.eventId === eventId ? { ...row, eventId: undefined, calendarDate: row.calendarDate || event?.date, updatedAt: now } : row));
    if (eventHubId === eventId) setEventHubId(null);
  };

  const executeNoahEventAction = async (action: NoahEventAction): Promise<NoahEventActionResult> => {
    const label = eventActionLabel(action, events);

    try {
      setMlbOpen(false);
      setEventEditorOpen(false);
      setSelectedEvent(null);
      setEventCreateDate(null);

      if (action.type === 'navigate_section') {
        const name = sectionName(action.section);
        showNoahActivity({ phase: 'working', title: `Pasando a ${name}`, detail: 'Cambiando de contexto', scope: 'NAVEGACIÓN' });
        setEventHubId(null);
        if (action.section === 'calendar') setMonth(startOfMonth(new Date()));
        setView(action.section);
        await sleep(180);
        showNoahActivity({ phase: 'done', title: name, detail: 'Listo', scope: 'NAVEGACIÓN' });
        return { ok: true, message: `Perfecto, pasamos a ${name}.` };
      }

      if (action.type === 'open_events') {
        showNoahActivity({ phase: 'working', ...label });
        setEventHubId(null);
        setView('events');
        await sleep(150);
        showNoahActivity({ phase: 'done', title: 'Eventos', detail: 'Agenda lista', scope: 'EVENTOS' });
        return { ok: true, message: 'Aquí están tus eventos.' };
      }

      if (action.type === 'create_sheet_row') {
        const now = new Date().toISOString();
        const row: SheetRow = {
          id: uid(),
          label: action.row.label || 'Movimiento',
          category: action.row.category || (action.row.financialType === 'expense' ? 'Gasto' : 'General'),
          amount: action.row.amount,
          currency: action.row.currency,
          status: action.row.status || 'pending',
          financialType: action.row.financialType || 'neutral',
          calendarDate: action.row.calendarDate,
          notes: action.row.notes,
          description: action.row.description,
          values: {},
          createdAt: now,
          updatedAt: now
        };
        showNoahActivity({
          phase: 'working',
          title: 'Agregando a Excel',
          detail: row.label,
          scope: 'EXCEL',
          steps: [
            { id: 'sheet-read', label: 'Movimiento entendido', value: financeText(action.row), state: 'done' },
            { id: 'sheet-write', label: 'Escribiendo fila', state: 'active' },
            { id: 'sheet-save', label: 'Guardando', state: 'pending' }
          ]
        });
        await db.sheetRows.add(row);
        setSheetRows((current) => [row, ...current]);
        await sleep(160);
        if (action.surface === 'calendar' && row.calendarDate) {
          setView('calendar');
          setMonth(startOfMonth(parseISO(row.calendarDate)));
          setNoahCalendarDates([row.calendarDate]);
        } else {
          setView('sheet');
          setSelectedSheetRowId(row.id);
        }
        showNoahActivity({
          phase: 'done',
          title: 'Movimiento guardado',
          detail: `${row.label} · ${financeText(action.row)}`,
          scope: 'EXCEL',
          steps: [
            { id: 'sheet-read', label: 'Movimiento entendido', value: financeText(action.row), state: 'done' },
            { id: 'sheet-write', label: 'Fila creada', state: 'done' },
            { id: 'sheet-save', label: 'Guardado', state: 'done' }
          ]
        });
        return { ok: true, message: 'Listo, quedó en Excel.' };
      }

      if (action.type === 'create_calendar_series') {
        const start = parseISO(action.startDate);
        const end = parseISO(action.endDate);
        const wantedWeekdays = new Set(action.weekdays);
        const dates: string[] = [];
        for (let day = start; day <= end; day = addDays(day, 1)) {
          if (wantedWeekdays.has(day.getDay())) dates.push(format(day, 'yyyy-MM-dd'));
        }
        if (!dates.length) {
          showNoahActivity({ phase: 'error', title: 'No encontré fechas', detail: 'Revisa el patrón solicitado', scope: 'CALENDARIO' });
          return { ok: false, message: 'No encontré fechas para ese patrón.' };
        }

        setEventHubId(null);
        setView('calendar');
        setMonth(startOfMonth(start));
        setNoahCalendarDates([]);
        showNoahActivity({
          phase: 'working',
          title: action.finance ? 'Construyendo matriz' : 'Creando serie en Calendario',
          detail: action.event.title,
          scope: action.finance ? 'MATRIZ' : 'CALENDARIO',
          steps: calendarSeriesSteps(0, dates.length, 'Preparando', action.finance)
        });
        await sleep(160);

        const existingKeys = new Set(events.map((event) => `${normalizedEventTitle(event.title)}|${event.date}`));
        const monthGroups = new Map<string, string[]>();
        for (const date of dates) {
          const key = date.slice(0, 7);
          const group = monthGroups.get(key) || [];
          group.push(date);
          monthGroups.set(key, group);
        }

        let created = 0;
        let skipped = 0;
        const firstMonthDates = monthGroups.values().next().value as string[] | undefined;

        for (const groupDates of monthGroups.values()) {
          const monthDate = startOfMonth(parseISO(groupDates[0]));
          const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });
          setMonth(monthDate);
          setNoahCalendarDates(groupDates);

          const batch: EventItem[] = [];
          for (const date of groupDates) {
            const duplicateKey = `${normalizedEventTitle(action.event.title)}|${date}`;
            if (existingKeys.has(duplicateKey)) {
              skipped += 1;
              continue;
            }
            existingKeys.add(duplicateKey);
            const now = new Date().toISOString();
            const showTime = action.event.showTime ?? action.event.time ?? '';
            batch.push({
              id: uid(),
              title: action.event.title.trim(),
              date,
              time: showTime,
              callTime: action.event.callTime,
              soundcheckTime: action.event.soundcheckTime,
              showTime,
              venue: action.event.venue,
              address: action.event.address,
              details: action.event.details,
              dressCode: action.event.dressCode,
              contactName: action.event.contactName,
              contactPhone: action.event.contactPhone,
              mapUrl: action.event.mapUrl,
              notes: action.event.notes,
              status: action.event.status || 'confirmed',
              createdAt: now,
              updatedAt: now
            });
          }

          if (batch.length) {
            await db.events.bulkAdd(batch);
            created += batch.length;
            setEvents((current) => sortEvents([...current, ...batch]));
            if (action.finance) {
              const rows: SheetRow[] = batch.map((event) => ({
                id: uid(),
                label: action.finance?.label || event.title,
                category: action.finance?.category || 'Evento',
                amount: action.finance!.amount,
                currency: action.finance!.currency,
                status: action.finance?.status || 'pending',
                financialType: action.finance?.financialType || 'income',
                eventId: event.id,
                calendarDate: event.date,
                notes: action.finance?.notes,
                description: action.finance?.description,
                values: {},
                createdAt: event.createdAt,
                updatedAt: event.updatedAt
              }));
              await db.sheetRows.bulkAdd(rows);
              setSheetRows((current) => [...rows.reverse(), ...current]);
            }
          }

          showNoahActivity({
            phase: 'working',
            title: action.finance ? 'Sincronizando matriz' : 'Escribiendo en Calendario',
            detail: action.event.title,
            scope: action.finance ? 'MATRIZ' : 'CALENDARIO',
            steps: calendarSeriesSteps(created + skipped, dates.length, monthLabel, action.finance)
          });
          await sleep(125);
        }

        if (firstMonthDates?.length) {
          setMonth(startOfMonth(parseISO(firstMonthDates[0])));
          setNoahCalendarDates(firstMonthDates);
        }
        const detail = skipped ? `${created} creados · ${skipped} ya existían` : `${created} eventos creados`;
        showNoahActivity({
          phase: 'done',
          title: action.finance ? 'Matriz sincronizada' : 'Serie creada',
          detail,
          scope: action.finance ? 'MATRIZ' : 'CALENDARIO',
          steps: calendarSeriesSteps(created + skipped, dates.length, '', action.finance, true)
        });
        return {
          ok: true,
          message: action.finance
            ? `Listo, creé ${created} eventos con Excel vinculado.`
            : skipped ? `Listo. Creé ${created} y omití ${skipped} que ya existían.` : `Listo, creé ${created} eventos en Calendario.`
        };
      }

      if (action.type === 'create_event') {
        const calendarSurface = action.surface !== 'events';
        const scope = action.finance ? 'MATRIZ' : calendarSurface ? 'CALENDARIO' : 'EVENTOS';
        const entries = patchEntries(action.event);
        showNoahActivity({
          phase: 'working',
          title: action.finance ? 'Construyendo matriz' : 'Creando evento',
          detail: action.event.title,
          scope,
          steps: action.finance ? matrixSteps(action.event.title, action.event.date, action.finance, 0) : progressSteps(entries, 'create', 0)
        });
        setEventHubId(null);
        if (calendarSurface) {
          setView('calendar');
          setMonth(startOfMonth(parseISO(action.event.date)));
          setNoahCalendarDates([action.event.date]);
        } else {
          setView('events');
        }
        await sleep(150);

        const now = new Date().toISOString();
        const showTime = action.event.showTime ?? action.event.time ?? '';
        const item: EventItem = {
          id: uid(),
          title: action.event.title.trim(),
          date: action.event.date,
          time: showTime,
          callTime: action.event.callTime,
          soundcheckTime: action.event.soundcheckTime,
          showTime,
          venue: action.event.venue,
          address: action.event.address,
          details: action.event.details,
          dressCode: action.event.dressCode,
          contactName: action.event.contactName,
          contactPhone: action.event.contactPhone,
          mapUrl: action.event.mapUrl,
          notes: action.event.notes,
          status: action.event.status || 'confirmed',
          createdAt: now,
          updatedAt: now
        };

        if (action.finance) {
          showNoahActivity({ phase: 'working', title: 'Construyendo matriz', detail: item.title, scope: 'MATRIZ', steps: matrixSteps(item.title, item.date, action.finance, 1) });
        }
        await db.events.add(item);
        setEvents((current) => sortEvents([...current, item]));
        await sleep(130);

        if (action.finance) {
          showNoahActivity({ phase: 'working', title: 'Sincronizando Excel', detail: item.title, scope: 'MATRIZ', steps: matrixSteps(item.title, item.date, action.finance, 2) });
          await syncFinanceForEvent(item, action.finance);
          await sleep(130);
          showNoahActivity({ phase: 'working', title: 'Vinculando todo', detail: item.title, scope: 'MATRIZ', steps: matrixSteps(item.title, item.date, action.finance, 3) });
          await sleep(120);
        }

        if (!calendarSurface) setEventHubId(item.id);
        showNoahActivity({
          phase: 'done',
          title: action.finance ? 'Todo sincronizado' : 'Evento creado',
          detail: item.title,
          scope,
          steps: action.finance ? matrixSteps(item.title, item.date, action.finance, 4, true) : progressSteps(entries, 'create', entries.length + 2, true)
        });
        return {
          ok: true,
          message: action.finance ? 'Listo, quedó sincronizado en Calendario, Eventos y Excel.' : calendarSurface ? 'Listo, ya está en Calendario.' : 'Listo, evento creado.'
        };
      }

      const target = events.find((event) => event.id === action.eventId);
      if (!target) {
        showNoahActivity({ phase: 'error', title: 'Evento no encontrado', detail: 'No hice cambios', scope: 'EVENTOS' });
        return { ok: false, message: 'No encontré ese evento.' };
      }

      if (action.type === 'sync_event_finance') {
        showNoahActivity({
          phase: 'working',
          title: 'Sincronizando monto',
          detail: target.title,
          scope: 'MATRIZ',
          steps: [
            { id: 'finance-event', label: 'Evento localizado', value: target.title, state: 'done' },
            { id: 'finance-excel', label: 'Excel', value: financeText(action.finance), state: 'active' },
            { id: 'finance-link', label: 'Vínculo por eventId', state: 'pending' }
          ]
        });
        const row = await syncFinanceForEvent(target, action.finance);
        await sleep(150);
        if (action.surface === 'calendar') {
          setView('calendar');
          setMonth(startOfMonth(parseISO(target.date)));
          setNoahCalendarDates([target.date]);
        } else if (action.surface === 'events') {
          setView('events');
          setEventHubId(target.id);
        } else {
          setView('sheet');
          setSelectedSheetRowId(row.id);
        }
        showNoahActivity({
          phase: 'done',
          title: 'Monto sincronizado',
          detail: `${target.title} · ${financeText(action.finance)}`,
          scope: 'MATRIZ',
          steps: [
            { id: 'finance-event', label: 'Evento localizado', value: target.title, state: 'done' },
            { id: 'finance-excel', label: 'Excel actualizado', value: financeText(action.finance), state: 'done' },
            { id: 'finance-link', label: 'Vínculo por eventId', state: 'done' }
          ]
        });
        return { ok: true, message: 'Listo, el monto quedó sincronizado con el evento.' };
      }

      if (action.type === 'open_event') {
        showNoahActivity({ phase: 'working', title: 'Abriendo ficha', detail: target.title, scope: 'EVENTOS' });
        setView('events');
        setEventHubId(target.id);
        await sleep(160);
        showNoahActivity({ phase: 'done', title: target.title, detail: 'Ficha abierta', scope: 'EVENTOS' });
        return { ok: true, message: 'Aquí está.' };
      }

      if (action.type === 'update_event') {
        const entries = patchEntries(action.patch);
        const linkedRows = sheetRows.filter((row) => row.eventId === target.id);
        showNoahActivity({ phase: 'working', title: 'Actualizando evento', detail: target.title, scope: linkedRows.length && action.patch.date ? 'MATRIZ' : 'EVENTOS', steps: progressSteps(entries, 'update', 0) });
        setView('events');
        setEventHubId(target.id);
        await sleep(200);

        let currentTarget = target;
        for (let index = 0; index < entries.length; index += 1) {
          const [key, value] = entries[index];
          showNoahActivity({ phase: 'working', title: 'Actualizando evento', detail: currentTarget.title, scope: linkedRows.length && key === 'date' ? 'MATRIZ' : 'EVENTOS', steps: progressSteps(entries, 'update', index + 1) });
          const patch: Partial<EventItem> & { updatedAt: string } = { [key]: value, updatedAt: new Date().toISOString() } as Partial<EventItem> & { updatedAt: string };
          if (key === 'showTime') patch.time = String(value || '');
          await db.events.update(target.id, patch);
          currentTarget = { ...currentTarget, ...patch };
          setEvents((current) => sortEvents(current.map((event) => event.id === target.id ? currentTarget : event)));

          if (key === 'date' && typeof value === 'string' && linkedRows.length) {
            const updatedAt = new Date().toISOString();
            await Promise.all(linkedRows.map((row) => db.sheetRows.update(row.id, { calendarDate: value, updatedAt })));
            setSheetRows((current) => current.map((row) => row.eventId === target.id ? { ...row, calendarDate: value, updatedAt } : row));
          }
          await sleep(220);
        }

        showNoahActivity({ phase: 'done', title: 'Evento actualizado', detail: currentTarget.title, scope: linkedRows.length && action.patch.date ? 'MATRIZ' : 'EVENTOS', steps: progressSteps(entries, 'update', entries.length + 2, true) });
        return { ok: true, message: linkedRows.length && action.patch.date ? 'Listo, moví el evento y mantuve Excel sincronizado.' : 'Listo, quedó actualizado.' };
      }

      if (action.type === 'delete_event') {
        const steps: NoahActionStep[] = [
          { id: 'delete-locate', label: 'Evento localizado', value: target.title, state: 'active' },
          { id: 'delete-links', label: 'Revisando vínculos', state: 'pending' },
          { id: 'delete-final', label: 'Eliminando', state: 'pending' }
        ];
        setView('events');
        setEventHubId(target.id);
        showNoahActivity({ phase: 'working', title: 'Eliminando evento', detail: target.title, scope: 'EVENTOS', steps });
        await sleep(220);
        showNoahActivity({ phase: 'working', title: 'Eliminando evento', detail: target.title, scope: 'EVENTOS', steps: steps.map((step, index) => ({ ...step, state: index === 0 ? 'done' : index === 1 ? 'active' : 'pending' })) });
        await sleep(220);
        await deleteEventWithRelations(target.id);
        showNoahActivity({ phase: 'done', title: 'Evento eliminado', detail: target.title, scope: 'EVENTOS', steps: steps.map((step) => ({ ...step, state: 'done' })) });
        return { ok: true, message: 'Listo, quedó eliminado.' };
      }

      showNoahActivity({ phase: 'error', title: 'Acción no disponible', detail: 'No hice cambios', scope: 'EVENTOS' });
      return { ok: false, message: 'Esa acción todavía no está disponible.' };
    } catch {
      showNoahActivity({ phase: 'error', title: 'No pude completar la acción', detail: label.detail, scope: label.scope || 'EVENTOS' });
      return { ok: false, message: 'No pude completar ese cambio.' };
    }
  };

  const executeNoahImageActions = async (actions: NoahChatAction[]) => {
    for (const action of actions) {
      const result = isNoahSheetAction(action)
        ? await executeNoahSheetAction(action)
        : await executeNoahEventAction(action);
      if (!result.ok) throw new Error(result.message || 'action_failed');
    }
    await refresh();
  };

  const saveEvent = async (draft: EventDraft) => {
    const now = new Date().toISOString();
    if (selectedEvent) await db.events.update(selectedEvent.id, { ...draft, updatedAt: now });
    else await db.events.add({ ...draft, id: uid(), createdAt: now, updatedAt: now });
    setEventEditorOpen(false);
    setSelectedEvent(null);
    setEventCreateDate(null);
    await refresh();
  };

  const deleteSelectedEvents = async (selected: EventItem[]) => {
    for (const event of selected) await deleteEventWithRelations(event.id);
    await refresh();
  };

  const toggleReminder = async (item: ReminderItem) => {
    const now = new Date().toISOString();
    if (!item.done && item.repeat && item.repeat !== 'none' && item.dueAt) {
      const dueAt = nextReminderDate(item.dueAt, item.repeat);
      const patch = { dueAt, done: false, lastCompletedAt: now, lastNotifiedAt: undefined, updatedAt: now };
      await db.reminders.update(item.id, patch);
      setReminders((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry));
    } else {
      const patch = { done: !item.done, lastCompletedAt: !item.done ? now : item.lastCompletedAt, updatedAt: now };
      await db.reminders.update(item.id, patch);
      setReminders((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry));
    }
  };

  const openSheetRow = (rowId?: string) => {
    setSelectedSheetRowId(rowId || null);
    setView('sheet');
  };

  return (
    <div className="app-shell">
      <div className="background-photo" aria-hidden="true" />
      <div className="background-shade" aria-hidden="true" />

      <header className="topbar"><div><h1>DJ NOA</h1><p className="topbar-date">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p></div></header>

      <main className="content">
        {mlbOpen ? <MlbWorkspace onBack={() => setMlbOpen(false)} /> : <>
          {view === 'home' && <HomeView
            todayEventCount={todayEventCount}
            upcoming={upcoming}
            eventCount={events.length}
            total={total}
            openReminders={openReminders}
            focusReminders={focusReminders}
            onVoice={startNoah}
            onView={setView}
            onOpenMlb={() => setMlbOpen(true)}
            onOpenEvent={openEventHub}
            onCreateEvent={() => openEventEditor()}
            onToggleReminder={toggleReminder}
          />}
          {view === 'events' && <EventsView events={events} onOpen={openEventHub} onCreate={() => openEventEditor()} onEdit={(event) => openEventEditor(event)} onDelete={deleteSelectedEvents} />}
          {view === 'calendar' && <CalendarWorkspace month={month} setMonth={setMonth} events={events} reminders={reminders} sheetRows={sheetRows} noahHighlightDates={noahCalendarDates} onOpenEvent={openEventHub} onCreateEvent={(date) => openEventEditor(undefined, date)} onToggleReminder={toggleReminder} onOpenReminders={() => setView('reminders')} onOpenSheetRow={openSheetRow} />}
          {view === 'sheet' && <SheetWorkspace rows={sheetRows} events={events} onChanged={refresh} onAssistant={startNoah} openRowId={selectedSheetRowId} onOpenRowHandled={() => setSelectedSheetRowId(null)} />}
          {view === 'reminders' && <ReminderWorkspace items={reminders} events={events} onChanged={refresh} onAssistant={startNoah} />}
        </>}
      </main>

      <BottomNav view={view} onView={(next) => { setMlbOpen(false); setEventHubId(null); setNoahCalendarDates([]); setView(next); }} />
      <NoahVoice ref={noahRef} events={events} sheetRows={sheetRows} section={mlbOpen ? 'mlb' : view} onEventAction={executeNoahEventAction} />
      <NoahImageIntake onApply={executeNoahImageActions} />
      <NoahActionOverlay activity={noahActivity} />

      {hubEvent && <EventHub event={hubEvent} reminders={reminders} sheetRows={sheetRows} onClose={() => setEventHubId(null)} onEdit={() => openEventEditor(hubEvent)} onOpenCalendar={() => { setMonth(parseISO(hubEvent.date)); setEventHubId(null); setView('calendar'); }} onOpenReminders={() => { setEventHubId(null); setView('reminders'); }} onOpenSheet={() => { setEventHubId(null); setView('sheet'); }} onToggleReminder={toggleReminder} />}

      {eventEditorOpen && <EventEditor event={selectedEvent} initialDate={eventCreateDate} onClose={() => { setEventEditorOpen(false); setSelectedEvent(null); setEventCreateDate(null); }} onSave={saveEvent} />}
    </div>
  );
}
