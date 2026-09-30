import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, addWeeks, format, isAfter, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import CalendarWorkspace from './CalendarWorkspace';
import { EventEditor, EventHub, EventsView, type EventDraft } from './EventWorkspace';
import MlbWorkspace from './MlbWorkspace';
import NoahActionOverlay from './NoahActionOverlay';
import NoahVoice, { type NoahVoiceHandle } from './NoahVoice';
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
  type NoahEventPatch
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

function calendarSeriesSteps(created: number, total: number, monthLabel: string, complete = false): NoahActionStep[] {
  return [
    { id: 'series-pattern', label: 'Patrón entendido', state: 'done' },
    { id: 'series-calendar', label: 'Calendario abierto', state: 'done' },
    {
      id: 'series-write',
      label: complete ? 'Fechas creadas' : 'Agregando fechas',
      value: complete ? `${created}` : `${monthLabel} · ${created}/${total}`,
      state: complete ? 'done' : 'active'
    },
    { id: 'series-save', label: 'Guardando serie', state: complete ? 'done' : 'pending' }
  ];
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

  const total = useMemo(() => sheetRows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [sheetRows]);
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
        showNoahActivity({ phase: 'working', title: 'Creando serie en Calendario', detail: action.event.title, scope: 'CALENDARIO', steps: calendarSeriesSteps(0, dates.length, 'Preparando') });
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
          }

          showNoahActivity({
            phase: 'working',
            title: 'Escribiendo en Calendario',
            detail: action.event.title,
            scope: 'CALENDARIO',
            steps: calendarSeriesSteps(created + skipped, dates.length, monthLabel)
          });
          await sleep(125);
        }

        if (firstMonthDates?.length) {
          setMonth(startOfMonth(parseISO(firstMonthDates[0])));
          setNoahCalendarDates(firstMonthDates);
        }
        const detail = skipped ? `${created} creados · ${skipped} ya existían` : `${created} eventos creados`;
        showNoahActivity({ phase: 'done', title: 'Serie creada', detail, scope: 'CALENDARIO', steps: calendarSeriesSteps(created + skipped, dates.length, '', true) });
        return { ok: true, message: skipped ? `Listo. Creé ${created} y omití ${skipped} que ya existían.` : `Listo, creé ${created} eventos en Calendario.` };
      }

      if (action.type === 'create_event') {
        const calendarSurface = action.surface === 'calendar';
        const entries = patchEntries(action.event);
        const scope = calendarSurface ? 'CALENDARIO' : 'EVENTOS';
        showNoahActivity({ phase: 'working', title: 'Creando evento', detail: action.event.title, scope, steps: progressSteps(entries, 'create', 0) });
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
        await db.events.add(item);
        setEvents((current) => sortEvents([...current, item]));
        if (!calendarSurface) setEventHubId(item.id);
        await sleep(180);
        showNoahActivity({ phase: 'done', title: 'Evento creado', detail: item.title, scope, steps: progressSteps(entries, 'create', entries.length + 2, true) });
        return { ok: true, message: calendarSurface ? 'Listo, ya está en Calendario.' : 'Listo, evento creado.' };
      }

      const target = events.find((event) => event.id === action.eventId);
      if (!target) {
        showNoahActivity({ phase: 'error', title: 'Evento no encontrado', detail: 'No hice cambios', scope: 'EVENTOS' });
        return { ok: false, message: 'No encontré ese evento.' };
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
        showNoahActivity({ phase: 'working', title: 'Actualizando evento', detail: target.title, scope: 'EVENTOS', steps: progressSteps(entries, 'update', 0) });
        setView('events');
        setEventHubId(target.id);
        await sleep(200);

        let currentTarget = target;
        for (let index = 0; index < entries.length; index += 1) {
          const [key, value] = entries[index];
          showNoahActivity({ phase: 'working', title: 'Actualizando evento', detail: currentTarget.title, scope: 'EVENTOS', steps: progressSteps(entries, 'update', index + 1) });
          const patch: Partial<EventItem> & { updatedAt: string } = { [key]: value, updatedAt: new Date().toISOString() } as Partial<EventItem> & { updatedAt: string };
          if (key === 'showTime') patch.time = String(value || '');
          await db.events.update(target.id, patch);
          currentTarget = { ...currentTarget, ...patch };
          setEvents((current) => sortEvents(current.map((event) => event.id === target.id ? currentTarget : event)));
          await sleep(220);
        }

        showNoahActivity({ phase: 'done', title: 'Evento actualizado', detail: currentTarget.title, scope: 'EVENTOS', steps: progressSteps(entries, 'update', entries.length + 2, true) });
        return { ok: true, message: 'Listo, quedó actualizado.' };
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
      <NoahVoice ref={noahRef} events={events} section={mlbOpen ? 'mlb' : view} onEventAction={executeNoahEventAction} />
      <NoahActionOverlay activity={noahActivity} />

      {hubEvent && <EventHub event={hubEvent} reminders={reminders} sheetRows={sheetRows} onClose={() => setEventHubId(null)} onEdit={() => openEventEditor(hubEvent)} onOpenCalendar={() => { setMonth(parseISO(hubEvent.date)); setEventHubId(null); setView('calendar'); }} onOpenReminders={() => { setEventHubId(null); setView('reminders'); }} onOpenSheet={() => { setEventHubId(null); setView('sheet'); }} onToggleReminder={toggleReminder} />}

      {eventEditorOpen && <EventEditor event={selectedEvent} initialDate={eventCreateDate} onClose={() => { setEventEditorOpen(false); setSelectedEvent(null); setEventCreateDate(null); }} onSave={saveEvent} />}
    </div>
  );
}
