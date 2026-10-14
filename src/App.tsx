import { useEffect, useMemo, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { ChevronLeft } from 'lucide-react';
import { performNativeBack, useNativeBack, useSystemBack } from './navigationBack';
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
import { normalizedEventIdentity } from './eventIntegrity';
import { formatMoneyTotals } from './moneyIntegrity';
import { createEventWithRelations, createEventsWithRelations, updateEventWithRelations, deleteEventWithRelations, syncEventFinance } from './eventMutations';
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
  const viewRef = useRef<AppView>('home');
  const viewHistoryRef = useRef<AppView[]>([]);

  const navigateTo = (next: AppView) => {
    if (next === viewRef.current) return;
    viewHistoryRef.current.push(viewRef.current);
    if (viewHistoryRef.current.length > 40) viewHistoryRef.current.shift();
    viewRef.current = next;
    setView(next);
  };
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

  const closeEventEditor = () => {
    setEventEditorOpen(false);
    setSelectedEvent(null);
    setEventCreateDate(null);
  };

  const goBack = () => {
    if (eventEditorOpen) { closeEventEditor(); return; }
    if (eventHubId) { setEventHubId(null); return; }
    if (mlbOpen) { setMlbOpen(false); return; }
    if (viewRef.current !== 'home') {
      const previous = viewHistoryRef.current.pop() || 'home';
      viewRef.current = previous;
      setNoahCalendarDates([]);
      setView(previous);
    }
  };

  useNativeBack(view !== 'home' || mlbOpen || Boolean(eventHubId) || eventEditorOpen, goBack, 10);
  useSystemBack();

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

  useEffect(() => {
    // All screens observe the same IndexedDB truth, including edits performed
    // by Noah's Excel module and another tab on the same device.
    const subscription = liveQuery(() => Promise.all([
      db.events.orderBy('date').toArray(),
      db.reminders.orderBy('createdAt').reverse().toArray(),
      db.sheetRows.orderBy('createdAt').reverse().toArray()
    ])).subscribe({
      next: ([eventData, reminderData, sheetData]) => {
        setEvents(eventData);
        setReminders(reminderData);
        setSheetRows(sheetData);
      },
      error: () => { void refresh(); }
    });
    return () => subscription.unsubscribe();
  }, []);
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

  const total = useMemo(() => formatMoneyTotals(sheetRows), [sheetRows]);
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
        navigateTo(action.section);
        await sleep(180);
        showNoahActivity({ phase: 'done', title: name, detail: 'Listo', scope: 'NAVEGACIÓN' });
        return { ok: true, message: `Perfecto, pasamos a ${name}.` };
      }

      if (action.type === 'open_events') {
        showNoahActivity({ phase: 'working', ...label });
        setEventHubId(null);
        navigateTo('events');
        await sleep(150);
        showNoahActivity({ phase: 'done', title: 'Eventos', detail: 'Agenda lista', scope: 'EVENTOS' });
        return { ok: true, message: 'Aquí están tus eventos.' };
      }

      if (action.type === 'create_sheet_row') {
        const now = new Date().toISOString();
        // Only an exact, unique name+date match may auto-link a financial
        // movement. A similar venue, date alone, or repeated event is not enough.
        const date = action.row.calendarDate;
        const title = (action.row.label || '').trim();
        const possibleEvents = date && title
          ? events.filter((candidate) => candidate.date === date &&
              normalizedEventIdentity(candidate.title, candidate.date) === normalizedEventIdentity(title, date))
          : [];
        const uniqueEvent = possibleEvents.length === 1 ? possibleEvents[0] : undefined;
        const row: SheetRow = {
          id: uid(),
          label: action.row.label || 'Movimiento',
          category: action.row.category || (action.row.financialType === 'expense' ? 'Gasto' : 'General'),
          amount: action.row.amount,
          currency: action.row.currency,
          status: action.row.status || 'pending',
          financialType: action.row.financialType || 'neutral',
          eventId: uniqueEvent?.id,
          calendarDate: action.row.calendarDate,
          calendarDateSource: date ? 'manual' : undefined,
          syncManaged: false,
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
          navigateTo('calendar');
          setMonth(startOfMonth(parseISO(row.calendarDate)));
          setNoahCalendarDates([row.calendarDate]);
        } else {
          navigateTo('sheet');
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
        return { ok: true, message: uniqueEvent ? 'Listo, quedó en Excel y vinculado al evento.' : 'Listo, quedó en Excel.' };
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
        navigateTo('calendar');
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

          const drafts = groupDates.map((date) => ({
            title: action.event.title.trim(),
            date,
            time: action.event.showTime ?? action.event.time ?? '',
            callTime: action.event.callTime,
            soundcheckTime: action.event.soundcheckTime,
            showTime: action.event.showTime ?? action.event.time ?? '',
            venue: action.event.venue,
            address: action.event.address,
            details: action.event.details,
            dressCode: action.event.dressCode,
            contactName: action.event.contactName,
            contactPhone: action.event.contactPhone,
            mapUrl: action.event.mapUrl,
            notes: action.event.notes,
            status: action.event.status || 'confirmed' as const
          }));
          // Each month is a single transaction: event + Excel or neither.
          const batchResult = await createEventsWithRelations(drafts, {
            finance: action.finance,
            createExcelConcept: !action.finance,
            skipDuplicates: true
          });
          created += batchResult.created.length;
          skipped += batchResult.skipped;
          if (batchResult.created.length) {
            setEvents((current) => sortEvents([...current, ...batchResult.created]));
          }
          if (batchResult.sheetRows.length) {
            setSheetRows((current) => [...batchResult.sheetRows, ...current]);
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
        const syncExcel = Boolean(action.finance || action.createExcelConcept);
        const scope = syncExcel ? 'MATRIZ' : calendarSurface ? 'CALENDARIO' : 'EVENTOS';
        const entries = patchEntries(action.event);
        showNoahActivity({
          phase: 'working',
          title: syncExcel ? 'Construyendo matriz' : 'Creando evento',
          detail: action.event.title,
          scope,
          steps: action.finance ? matrixSteps(action.event.title, action.event.date, action.finance, 0) : progressSteps(entries, 'create', 0)
        });
        setEventHubId(null);
        if (calendarSurface) {
          navigateTo('calendar');
          setMonth(startOfMonth(parseISO(action.event.date)));
          setNoahCalendarDates([action.event.date]);
        } else {
          navigateTo('events');
        }
        await sleep(150);

        const now = new Date().toISOString();
        const showTime = action.event.showTime ?? action.event.time ?? '';
        let item: EventItem = {
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
        const result = await createEventWithRelations(item, {
          finance: action.finance,
          createExcelConcept: Boolean(action.createExcelConcept) || Boolean(action.finance),
          skipDuplicates: true
        });
        if (result.skipped || !result.event) {
          showNoahActivity({ phase: 'done', title: 'Evento existente', detail: `${item.title} · ${item.date}`, scope });
          return { ok: true, message: 'El evento ya existe en esa fecha. No dupliqué sus registros.' };
        }
        item = result.event;
        setEvents((current) => sortEvents([...current, item]));
        if (result.row) setSheetRows((current) => [result.row!, ...current]);
        await sleep(130);

        if (action.finance) {
          showNoahActivity({ phase: 'working', title: 'Sincronizando Excel', detail: item.title, scope: 'MATRIZ', steps: matrixSteps(item.title, item.date, action.finance, 2) });
          // Finance was committed together with the event in one transaction.
          await sleep(130);
          showNoahActivity({ phase: 'working', title: 'Vinculando todo', detail: item.title, scope: 'MATRIZ', steps: matrixSteps(item.title, item.date, action.finance, 3) });
          await sleep(120);
        } else if (action.createExcelConcept) {
          showNoahActivity({
            phase: 'working',
            title: 'Creando concepto en Excel',
            detail: item.title,
            scope: 'MATRIZ',
            steps: [
              { id: 'photo-calendar', label: 'Calendario', value: item.date, state: 'done' },
              { id: 'photo-event', label: 'Evento', value: item.title, state: 'done' },
              { id: 'photo-excel', label: 'Excel · concepto', value: item.title, state: 'active' },
              { id: 'photo-money', label: 'Monto', value: 'Pendiente', state: 'pending' }
            ]
          });
          // The empty Excel concept was committed with the event.
          await sleep(130);
        }

        if (!calendarSurface) setEventHubId(item.id);
        showNoahActivity({
          phase: 'done',
          title: syncExcel ? 'Todo sincronizado' : 'Evento creado',
          detail: item.title,
          scope,
          steps: action.finance
            ? matrixSteps(item.title, item.date, action.finance, 4, true)
            : action.createExcelConcept
              ? [
                  { id: 'photo-calendar', label: 'Calendario', value: item.date, state: 'done' },
                  { id: 'photo-event', label: 'Evento', value: item.title, state: 'done' },
                  { id: 'photo-excel', label: 'Excel · concepto', value: item.title, state: 'done' },
                  { id: 'photo-money', label: 'Monto', value: 'Pendiente', state: 'done' }
                ]
              : progressSteps(entries, 'create', entries.length + 2, true)
        });
        return {
          ok: true,
          message: action.finance
            ? 'Listo, quedó sincronizado en Calendario, Eventos y Excel.'
            : action.createExcelConcept
              ? 'Listo, quedó en Calendario, Eventos y Excel. El monto queda pendiente.'
              : calendarSurface ? 'Listo, ya está en Calendario.' : 'Listo, evento creado.'
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
        const row = await syncEventFinance(target.id, action.finance);
        await sleep(150);
        if (action.surface === 'calendar') {
          navigateTo('calendar');
          setMonth(startOfMonth(parseISO(target.date)));
          setNoahCalendarDates([target.date]);
        } else if (action.surface === 'events') {
          navigateTo('events');
          setEventHubId(target.id);
        } else {
          navigateTo('sheet');
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
        navigateTo('events');
        setEventHubId(target.id);
        await sleep(160);
        showNoahActivity({ phase: 'done', title: target.title, detail: 'Ficha abierta', scope: 'EVENTOS' });
        return { ok: true, message: 'Aquí está.' };
      }

      if (action.type === 'update_event') {
        const entries = patchEntries(action.patch);
        const linkedRows = sheetRows.filter((row) => row.eventId === target.id);
        showNoahActivity({ phase: 'working', title: 'Actualizando evento', detail: target.title, scope: linkedRows.length && action.patch.date ? 'MATRIZ' : 'EVENTOS', steps: progressSteps(entries, 'update', 0) });
        navigateTo('events');
        setEventHubId(target.id);
        await sleep(200);

        // Apply all fields and inherited dates in a single transaction.
        const currentTarget = await updateEventWithRelations(target.id, action.patch);
        setEvents((current) => sortEvents(current.map((event) => event.id === target.id ? currentTarget : event)));
        await refresh();

        showNoahActivity({ phase: 'done', title: 'Evento actualizado', detail: currentTarget.title, scope: linkedRows.length && action.patch.date ? 'MATRIZ' : 'EVENTOS', steps: progressSteps(entries, 'update', entries.length + 2, true) });
        return { ok: true, message: linkedRows.length && action.patch.date ? 'Listo, moví el evento y mantuve Excel sincronizado.' : 'Listo, quedó actualizado.' };
      }

      if (action.type === 'delete_event') {
        const steps: NoahActionStep[] = [
          { id: 'delete-locate', label: 'Evento localizado', value: target.title, state: 'active' },
          { id: 'delete-links', label: 'Revisando vínculos', state: 'pending' },
          { id: 'delete-final', label: 'Eliminando', state: 'pending' }
        ];
        navigateTo('events');
        setEventHubId(target.id);
        showNoahActivity({ phase: 'working', title: 'Eliminando evento', detail: target.title, scope: 'EVENTOS', steps });
        await sleep(220);
        showNoahActivity({ phase: 'working', title: 'Eliminando evento', detail: target.title, scope: 'EVENTOS', steps: steps.map((step, index) => ({ ...step, state: index === 0 ? 'done' : index === 1 ? 'active' : 'pending' })) });
        await sleep(220);
        await deleteEventWithRelations(target.id);
        if (eventHubId === target.id) setEventHubId(null);
        await refresh();
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
    let blankExcelCount = 0;
    for (const action of actions) {
      const result = isNoahSheetAction(action)
        ? await executeNoahSheetAction(action)
        : await executeNoahEventAction(action);
      if (!result.ok) throw new Error(result.message || 'action_failed');
      if (action.type === 'create_event' && action.createExcelConcept && !action.finance) blankExcelCount += 1;
    }
    await refresh();
    if (blankExcelCount > 0) {
      showNoahActivity({
        phase: 'done',
        title: 'Todo organizado',
        detail: blankExcelCount === 1 ? 'Queda pendiente el monto de Excel' : `Quedan pendientes ${blankExcelCount} montos de Excel`,
        scope: 'MATRIZ'
      });
    }
  };

  const saveEvent = async (draft: EventDraft) => {
    if (selectedEvent) await updateEventWithRelations(selectedEvent.id, draft);
    else await createEventWithRelations(draft, { createExcelConcept: true });
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
    navigateTo('sheet');
  };

  return (
    <div className="app-shell ios-shell">
      <div className="background-photo" aria-hidden="true" />
      <div className="background-shade" aria-hidden="true" />
      {view !== 'home' && !mlbOpen && !eventHubId && !eventEditorOpen && (
        <button type="button" className="ios-global-back" aria-label="Volver a la pantalla anterior" onClick={() => void performNativeBack()}>
          <ChevronLeft size={23} strokeWidth={2.3} /><span>Volver</span>
        </button>
      )}

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
          {view === 'calendar' && <CalendarWorkspace month={month} setMonth={setMonth} events={events} reminders={reminders} sheetRows={sheetRows} noahHighlightDates={noahCalendarDates} onOpenEvent={openEventHub} onCreateEvent={(date) => openEventEditor(undefined, date)} onToggleReminder={toggleReminder} onOpenReminders={() => navigateTo('reminders')} onOpenSheetRow={openSheetRow} />}
          {view === 'sheet' && <SheetWorkspace rows={sheetRows} events={events} onChanged={refresh} onAssistant={startNoah} openRowId={selectedSheetRowId} onOpenRowHandled={() => setSelectedSheetRowId(null)} />}
          {view === 'reminders' && <ReminderWorkspace items={reminders} events={events} onChanged={refresh} onAssistant={startNoah} />}
        </>}
      </main>

      <BottomNav view={view} onView={(next) => { setMlbOpen(false); setEventHubId(null); setNoahCalendarDates([]); navigateTo(next); }} />
      <NoahVoice ref={noahRef} events={events} sheetRows={sheetRows} section={mlbOpen ? 'mlb' : view} onEventAction={executeNoahEventAction} />
      <NoahImageIntake onApply={executeNoahImageActions} />
      <NoahActionOverlay activity={noahActivity} />

      {hubEvent && <EventHub event={hubEvent} reminders={reminders} sheetRows={sheetRows} onClose={() => setEventHubId(null)} onEdit={() => openEventEditor(hubEvent)} onOpenCalendar={() => { setMonth(parseISO(hubEvent.date)); setEventHubId(null); navigateTo('calendar'); }} onOpenReminders={() => { setEventHubId(null); navigateTo('reminders'); }} onOpenSheet={() => { setEventHubId(null); navigateTo('sheet'); }} onToggleReminder={toggleReminder} />}

      {eventEditorOpen && <EventEditor event={selectedEvent} initialDate={eventCreateDate} onClose={closeEventEditor} onSave={saveEvent} />}
    </div>
  );
}
