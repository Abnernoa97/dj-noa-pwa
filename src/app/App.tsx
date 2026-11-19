import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { ChevronLeft } from 'lucide-react';
import { performNativeBack, useNativeBack, useSystemBack } from './navigationBack';
import { useExcelLandscape } from '../features/excel/useExcelLandscape';
import { format, isAfter, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { nextReminderOccurrence } from '../domains/reminders/reminderRecurrence';
import { es } from 'date-fns/locale';

import type { EventDraft } from '../features/events/EventWorkspace';

import NoahActionOverlay from '../features/noah/NoahActionOverlay';
import NoahImageIntake from '../features/noah/NoahImageIntake';
import { commitNoahVision, type VisionSource } from '../domains/noah/noahVisionCommit';
import type { ReviewAction } from '../domains/noah/noahImageReconcile';
import NoahVoice, { type NoahVoiceHandle } from '../features/noah/NoahVoice';



import { db } from '../services/storage/db';
import { formatMoneyAmount } from '../domains/finance/moneyIntegrity';
import { portfolioUsdSettlement } from '../domains/finance/financialOverview';
import { createEventWithRelations, updateEventWithRelations, deleteEventWithRelations } from '../domains/events/eventMutations';
import { scheduleReminderNotifications } from '../features/tasks/reminderNotifications';
import type { AppView, EventItem, ReminderItem, SheetRow } from '../shared/types';
import type { NoahActionActivity } from '../domains/noah/noahEvents';
import type { NoahEventAction, NoahEventActionResult } from '../domains/noah/noahEvents';
import BottomNav from './BottomNav';
import HomeView from './HomeView';
// Feature screens are loaded only when visited; VitePWA precaches their chunks
// for subsequent offline visits without duplicating the local Dexie store.
const CalendarWorkspace = lazy(() => import('../features/calendar/CalendarWorkspace'));
const MlbWorkspace = lazy(() => import('../features/sports/MlbWorkspace'));
const ReminderWorkspace = lazy(() => import('../features/tasks/ReminderWorkspace'));
const SheetWorkspace = lazy(() => import('../features/excel/SheetWorkspace'));
const EventsView = lazy(() => import('../features/events/EventWorkspace').then((module) => ({ default: module.EventsView })));
const EventHub = lazy(() => import('../features/events/EventWorkspace').then((module) => ({ default: module.EventHub })));
const EventEditor = lazy(() => import('../features/events/EventWorkspace').then((module) => ({ default: module.EventEditor })));


function safeDate(value?: string) {
  if (!value) return null;
  try { return parseISO(value); } catch { return null; }
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
  const { isPortrait: excelPortrait, requestLandscape } = useExcelLandscape(view === 'sheet' && !mlbOpen && !eventEditorOpen && !eventHubId);
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

  const total = useMemo(() => {
    const value = portfolioUsdSettlement(sheetRows).contracted;
    return value === null ? 'Por revisar' : formatMoneyAmount(value, 'USD') + ' USD';
  }, [sheetRows]);
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
    // Noah's long-running write coordinator is required only when an action
    // is executed, not during initial navigation or ordinary voice playback.
    const { createNoahActionExecutor } = await import('./controllers/noahActionCoordinator');
    return createNoahActionExecutor({
      events, sheetRows, eventHubId,
      navigateTo, refresh, showNoahActivity,
      setMlbOpen, setEventEditorOpen, setSelectedEvent, setEventCreateDate,
      setEventHubId, setMonth, setNoahCalendarDates, setEvents, setSheetRows, setSelectedSheetRowId
    })(action);
  };

  const executeNoahImageActions = async (proposals: ReviewAction[], sources: VisionSource[]) => {
    // One guarded transaction binds original source photos, event records
    // and separate payment/advance rows, or none of them if it fails.
    const saved = await commitNoahVision(proposals, sources);
    // A refresh error after a successful database transaction is not a failed save.
    try { await refresh(); } catch { /* liveQuery will update when available */ }
    showNoahActivity({
      phase: 'done', title: 'Datos organizados desde fotografías',
      detail: `${saved.eventCount} eventos · ${saved.movementCount} movimientos · ${sources.length} fotos analizadas (sin guardar imágenes)`,
      scope: 'MATRIZ'
    });
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
      const dueAt = nextReminderOccurrence(item.dueAt, item.repeat);
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
        <Suspense fallback={<div className="empty-state" role="status">Abriendo sección…</div>}>
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
          {view === 'sheet' && <SheetWorkspace rows={sheetRows} events={events} onChanged={refresh} onAssistant={startNoah} openRowId={selectedSheetRowId} onOpenRowHandled={() => setSelectedSheetRowId(null)} landscapePortrait={excelPortrait} onLandscapeRequest={() => { void requestLandscape(); }} />}
          {view === 'reminders' && <ReminderWorkspace items={reminders} events={events} onChanged={refresh} onAssistant={startNoah} />}
        </>}
        </Suspense>
      </main>

      <BottomNav view={view} onView={(next) => { setMlbOpen(false); setEventHubId(null); setNoahCalendarDates([]); navigateTo(next); }} />
      <NoahVoice ref={noahRef} events={events} sheetRows={sheetRows} section={mlbOpen ? 'mlb' : view} onEventAction={executeNoahEventAction} />
      <NoahImageIntake onApply={executeNoahImageActions} />
      <NoahActionOverlay activity={noahActivity} />

      <Suspense fallback={null}>
      {hubEvent && <EventHub event={hubEvent} reminders={reminders} sheetRows={sheetRows} onClose={() => setEventHubId(null)} onEdit={() => openEventEditor(hubEvent)} onOpenCalendar={() => { setMonth(parseISO(hubEvent.date)); setEventHubId(null); navigateTo('calendar'); }} onOpenReminders={() => { setEventHubId(null); navigateTo('reminders'); }} onOpenSheet={() => { setEventHubId(null); navigateTo('sheet'); }} onToggleReminder={toggleReminder} />}

      {eventEditorOpen && <EventEditor event={selectedEvent} initialDate={eventCreateDate} onClose={closeEventEditor} onSave={saveEvent} />
      </Suspense>}
    </div>
  );
}
