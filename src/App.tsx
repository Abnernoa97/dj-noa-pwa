import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { addDays, addMonths, addWeeks, format, isAfter, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { askAssistantWithMemory } from './assistantMemory';
import CalendarWorkspace from './CalendarWorkspace';
import ConversationDock, { type ConversationTurn } from './ConversationDock';
import { EventEditor, EventHub, EventsView, type EventDraft } from './EventWorkspace';
import ReminderWorkspace from './ReminderWorkspace';
import SheetWorkspace from './SheetWorkspace';
import { db, uid } from './db';
import { scheduleReminderNotifications } from './reminderNotifications';
import { useDjNoaVoice } from './useDjNoaVoice';
import type { AppView, AssistantAction, EventItem, ReminderItem, SheetRow } from './types';
import BottomNav from './app/BottomNav';
import HomeView from './app/HomeView';
import { createActionExecutor } from './app/actionExecutor';
import {
  actionMeta,
  bindActionToCreatedEvent,
  createdEventIdFromSummary,
  isCancelCommand,
  isMutatingAction,
  isUndoCommand,
  sleep,
  type CommandCreatedEvent,
  type LiveActionState
} from './app/assistantActions';
import {
  captureUndoSnapshot,
  restoreUndoSnapshot,
  type StoredHistoryItem
} from './app/undoHistory';

function safeDate(value?: string) {
  if (!value) return null;
  try { return parseISO(value); } catch { return null; }
}

function nextReminderDate(dueAt: string, repeat: ReminderItem['repeat']) {
  const current = parseISO(dueAt);
  const next = repeat === 'daily' ? addDays(current, 1) : repeat === 'weekly' ? addWeeks(current, 1) : repeat === 'monthly' ? addMonths(current, 1) : current;
  return next.toISOString();
}

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [assistantReply, setAssistantReply] = useState('Dime qué necesitas y lo hago.');
  const [busy, setBusy] = useState(false);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventCreateDate, setEventCreateDate] = useState<string | null>(null);
  const [eventHubId, setEventHubId] = useState<string | null>(null);
  const [selectedSheetRowId, setSelectedSheetRowId] = useState<string | null>(null);
  const [liveAction, setLiveAction] = useState<LiveActionState | null>(null);
  const cancelRequestedRef = useRef(false);

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

  const refreshConversation = async () => {
    const history = (await db.history.orderBy('createdAt').reverse().limit(8).toArray()).reverse() as unknown as StoredHistoryItem[];
    setConversation(history.map((item) => ({
      id: item.id,
      command: item.command,
      result: item.result,
      createdAt: item.createdAt
    })));
  };

  useEffect(() => { void refresh(); void refreshConversation(); }, []);
  useEffect(() => scheduleReminderNotifications(reminders), [reminders]);
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!navigator.onLine) {
        if (active) setAiOnline(false);
        return;
      }
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        const payload = await response.json() as { service?: string };
        if (active) setAiOnline(response.ok && payload.service === 'dj-noa-worker');
      } catch {
        if (active) setAiOnline(false);
      }
    };
    const onOnline = () => void check();
    const onOffline = () => setAiOnline(false);
    void check();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const timer = window.setInterval(() => void check(), 60_000);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(timer);
    };
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
  const assistantContextEvent = hubEvent || (eventEditorOpen && selectedEvent ? selectedEvent : null);

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
    return event;
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

  const requestExecutionCancel = () => {
    cancelRequestedRef.current = true;
    setAssistantOpen(true);
    setAssistantReply('Entendido. Me detengo.');
    setLiveAction((current) => current ? {
      ...current,
      title: 'Deteniendo',
      detail: 'No ejecutaré los pasos que faltan.',
      status: 'cancelled'
    } : current);
  };

  const executeAction = createActionExecutor({
    events,
    selectedSheetRowId,
    setEvents,
    setReminders,
    setSheetRows,
    setSelectedSheetRowId,
    setView,
    deleteEventWithRelations
  });

  const undoLastCommand = async (): Promise<string> => {
    const history = await db.history.orderBy('createdAt').reverse().toArray() as unknown as StoredHistoryItem[];
    const target = history.find((item) => item.undoSnapshot && !item.undoneAt);
    if (!target?.undoSnapshot) {
      const reply = 'No tengo ningún cambio reciente que pueda deshacer.';
      setAssistantReply(reply);
      return reply;
    }

    setAssistantOpen(true);
    setEventEditorOpen(false);
    setEventHubId(null);
    setSelectedEvent(null);
    setLiveAction({ current: 1, total: 1, title: 'Deshaciendo lo último', detail: target.command, status: 'working' });
    await restoreUndoSnapshot(target.undoSnapshot);
    const now = new Date().toISOString();
    await (db.history as any).update(target.id, { undoneAt: now });
    const reply = `Listo. Deshice: ${target.command}.`;
    await db.history.add({ id: uid(), command: 'Deshaz lo último', result: reply, kind: 'undo', createdAt: now } as any);
    await refresh();
    await refreshConversation();
    setAssistantReply(reply);
    setCommand('');
    setLiveAction({ current: 1, total: 1, title: 'Cambio deshecho', detail: target.command, status: 'done' });
    await sleep(500);
    setLiveAction(null);
    return reply;
  };

  const runCommand = async (text = command): Promise<string | undefined> => {
    const clean = text.trim();
    if (!clean) return undefined;

    if (busy) {
      if (isCancelCommand(clean)) {
        requestExecutionCancel();
        return 'Entendido. Me detengo.';
      }
      return undefined;
    }

    setAssistantOpen(true);
    setPendingCommand(clean);
    cancelRequestedRef.current = false;
    setBusy(true);
    try {
      if (isUndoCommand(clean)) return await undoLastCommand();

      const recentHistory = (await db.history.orderBy('createdAt').reverse().limit(10).toArray()).reverse() as unknown as StoredHistoryItem[];
      const response = await askAssistantWithMemory(
        clean,
        { events, reminders, sheetRows },
        recentHistory,
        {
          view,
          activeEventId: assistantContextEvent?.id,
          activeEventTitle: assistantContextEvent?.title,
          activeEventDate: assistantContextEvent?.date,
          activeEventVenue: assistantContextEvent?.venue
        }
      );
      setAssistantReply(response.reply);
      const visibleTotal = response.actions.filter((action) => actionMeta(action).visible).length;
      const mutates = response.actions.some(isMutatingAction);
      const undoSnapshot = mutates ? await captureUndoSnapshot() : undefined;
      const actionSummary: string[] = [];
      const createdEventCount = response.actions.filter((action) => action.type === 'create_event').length;
      let createdEventInCommand: CommandCreatedEvent | null = null;
      let visibleIndex = 0;
      let completedActions = 0;
      let completedMutations = 0;

      if (visibleTotal) {
        setAssistantOpen(false);
        setEventEditorOpen(false);
        setEventHubId(null);
        setSelectedEvent(null);
        setEventCreateDate(null);
        setCommand('');
      }

      for (const action of response.actions) {
        if (cancelRequestedRef.current) break;

        const runtimeAction: AssistantAction = createdEventCount === 1
          ? bindActionToCreatedEvent(action, createdEventInCommand)
          : action;
        const meta = actionMeta(runtimeAction);
        if (meta.visible) {
          visibleIndex += 1;
          if (runtimeAction.type === 'create_event') setMonth(startOfMonth(parseISO(runtimeAction.date)));
          if (meta.view) setView(meta.view);
          setLiveAction({ current: visibleIndex, total: visibleTotal, title: meta.title, detail: meta.detail, status: 'working' });
          await sleep(90);
          if (cancelRequestedRef.current) break;
        }

        try {
          const summary = await executeAction(runtimeAction);
          completedActions += 1;
          if (isMutatingAction(runtimeAction)) completedMutations += 1;
          if (summary) actionSummary.push(summary);

          if (runtimeAction.type === 'create_event' && createdEventCount === 1) {
            const createdId = createdEventIdFromSummary(summary);
            if (createdId) createdEventInCommand = { id: createdId, date: runtimeAction.date };
          }
        } catch {
          const failReply = meta.title ? `No pude completar: ${meta.title.toLowerCase()}.` : 'No pude completar esa acción.';
          setAssistantReply(failReply);
          if (meta.visible) {
            setLiveAction({ current: visibleIndex, total: visibleTotal, title: meta.title, detail: 'La acción se detuvo aquí.', status: 'error' });
            await sleep(700);
            setLiveAction(null);
          }
          await db.history.add({ id: uid(), command: clean, result: failReply, actionSummary, undoSnapshot: completedMutations ? undoSnapshot : undefined, kind: 'command', createdAt: new Date().toISOString() } as any);
          await refresh();
          await refreshConversation();
          setPendingCommand(null);
          return failReply;
        }

        if (cancelRequestedRef.current) break;

        if (meta.visible) {
          setLiveAction({ current: visibleIndex, total: visibleTotal, title: meta.title, detail: meta.detail, status: 'done' });
          await sleep(150);
        }
      }

      if (cancelRequestedRef.current) {
        const reply = completedActions
          ? `Me detuve. Alcancé a completar ${completedActions} ${completedActions === 1 ? 'paso' : 'pasos'}; no ejecuté lo que faltaba.`
          : 'Me detuve antes de hacer cambios.';
        await db.history.add({ id: uid(), command: clean, result: reply, actionSummary, undoSnapshot: completedMutations ? undoSnapshot : undefined, kind: 'command', createdAt: new Date().toISOString() } as any);
        setAssistantReply(reply);
        setCommand('');
        await refresh();
        await refreshConversation();
        setPendingCommand(null);
        setLiveAction({ current: completedActions, total: Math.max(visibleTotal, completedActions || 1), title: 'Acción detenida', detail: reply, status: 'cancelled' });
        await sleep(500);
        setLiveAction(null);
        return reply;
      }

      await db.history.add({ id: uid(), command: clean, result: response.reply, actionSummary, undoSnapshot, kind: 'command', createdAt: new Date().toISOString() } as any);
      setAssistantReply(response.reply);
      setCommand('');
      await refresh();
      await refreshConversation();
      setPendingCommand(null);

      if (visibleTotal) {
        setLiveAction({ current: visibleTotal, total: visibleTotal, title: 'Listo', detail: response.reply, status: 'done' });
        await sleep(500);
        setLiveAction(null);
      }

      return response.reply;
    } finally {
      cancelRequestedRef.current = false;
      setPendingCommand(null);
      setBusy(false);
    }
  };

  const {
    active: voiceActive,
    listening,
    manualRecording,
    mode: voiceMode,
    toggle: startListening
  } = useDjNoaVoice({
    onCommand: runCommand,
    onOpen: () => setAssistantOpen(true),
    onLiveText: setCommand,
    onStatus: setAssistantReply
  });

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
        {view === 'home' && <HomeView
          todayEventCount={todayEventCount}
          upcoming={upcoming}
          eventCount={events.length}
          total={total}
          openReminders={openReminders}
          focusReminders={focusReminders}
          onVoice={startListening}
          onView={setView}
          onOpenEvent={openEventHub}
          onCreateEvent={() => openEventEditor()}
          onToggleReminder={toggleReminder}
        />}
        {view === 'events' && <EventsView events={events} onOpen={openEventHub} onCreate={() => openEventEditor()} onEdit={(event) => openEventEditor(event)} onDelete={deleteSelectedEvents} />}
        {view === 'calendar' && <CalendarWorkspace month={month} setMonth={setMonth} events={events} reminders={reminders} sheetRows={sheetRows} onOpenEvent={openEventHub} onCreateEvent={(date) => openEventEditor(undefined, date)} onToggleReminder={toggleReminder} onOpenReminders={() => setView('reminders')} onOpenSheetRow={openSheetRow} />}
        {view === 'sheet' && <SheetWorkspace rows={sheetRows} events={events} onChanged={refresh} onAssistant={() => setAssistantOpen(true)} openRowId={selectedSheetRowId} onOpenRowHandled={() => setSelectedSheetRowId(null)} />}
        {view === 'reminders' && <ReminderWorkspace items={reminders} events={events} onChanged={refresh} onAssistant={() => setAssistantOpen(true)} />}
      </main>

      {liveAction && <div className={`dj-live-action ${liveAction.status}`} role="status" aria-live="polite"><div className="dj-live-head"><div className="dj-live-kicker"><span className="dj-live-dot" />DJ NOA · {liveAction.status === 'working' ? 'TRABAJANDO' : liveAction.status === 'done' ? 'HECHO' : liveAction.status === 'cancelled' ? 'CANCELADO' : 'DETENIDO'}</div><div className="dj-live-controls"><span className="dj-live-count">{liveAction.current} de {liveAction.total}</span>{liveAction.status === 'working' && <button className="dj-live-cancel" onClick={requestExecutionCancel}>CANCELAR</button>}</div></div><strong>{liveAction.title}</strong><small>{liveAction.detail}</small><div className="dj-live-track"><span style={{ width: `${Math.max(8, (liveAction.current / Math.max(1, liveAction.total)) * 100)}%` }} /></div></div>}

      <button className={`voice-orb ${voiceActive ? 'listening' : ''}`} onClick={startListening} disabled={busy && !liveAction} aria-label={busy && liveAction ? 'Decir detener a DJ NOA' : voiceActive ? 'Pausar DJ NOA' : 'Hablar con DJ NOA'}>{voiceActive ? <MicOff size={28} /> : <Mic size={28} />}<span>{listening ? 'ESCUCHANDO' : voiceActive ? 'ACTIVO' : busy && liveAction ? 'DETENER' : 'HABLAR'}</span></button>

      <BottomNav view={view} onView={setView} />

      <ConversationDock
        expanded={assistantOpen}
        turns={conversation}
        pendingCommand={pendingCommand}
        reply={assistantReply}
        command={command}
        onCommandChange={setCommand}
        onSend={() => void runCommand()}
        onVoice={startListening}
        onExpand={() => setAssistantOpen(true)}
        onCollapse={() => setAssistantOpen(false)}
        busy={busy}
        listening={listening}
        manualRecording={manualRecording}
        voiceMode={voiceMode}
        aiOnline={aiOnline}
      />

      {hubEvent && <EventHub event={hubEvent} reminders={reminders} sheetRows={sheetRows} onClose={() => setEventHubId(null)} onEdit={() => openEventEditor(hubEvent)} onOpenCalendar={() => { setMonth(parseISO(hubEvent.date)); setEventHubId(null); setView('calendar'); }} onOpenReminders={() => { setEventHubId(null); setView('reminders'); }} onOpenSheet={() => { setEventHubId(null); setView('sheet'); }} onToggleReminder={toggleReminder} />}

      {eventEditorOpen && <EventEditor event={selectedEvent} initialDate={eventCreateDate} onClose={() => { setEventEditorOpen(false); setSelectedEvent(null); setEventCreateDate(null); }} onSave={saveEvent} />}
    </div>
  );
}