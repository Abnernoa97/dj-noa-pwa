import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, addWeeks, format, isAfter, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import CalendarWorkspace from './CalendarWorkspace';
import { EventEditor, EventHub, EventsView, type EventDraft } from './EventWorkspace';
import MlbWorkspace from './MlbWorkspace';
import NoahVoice, { type NoahVoiceHandle } from './NoahVoice';
import ReminderWorkspace from './ReminderWorkspace';
import SheetWorkspace from './SheetWorkspace';
import { db, uid } from './db';
import { scheduleReminderNotifications } from './reminderNotifications';
import type { AppView, EventItem, ReminderItem, SheetRow } from './types';
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
  const noahRef = useRef<NoahVoiceHandle>(null);

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
          {view === 'calendar' && <CalendarWorkspace month={month} setMonth={setMonth} events={events} reminders={reminders} sheetRows={sheetRows} onOpenEvent={openEventHub} onCreateEvent={(date) => openEventEditor(undefined, date)} onToggleReminder={toggleReminder} onOpenReminders={() => setView('reminders')} onOpenSheetRow={openSheetRow} />}
          {view === 'sheet' && <SheetWorkspace rows={sheetRows} events={events} onChanged={refresh} onAssistant={startNoah} openRowId={selectedSheetRowId} onOpenRowHandled={() => setSelectedSheetRowId(null)} />}
          {view === 'reminders' && <ReminderWorkspace items={reminders} events={events} onChanged={refresh} onAssistant={startNoah} />}
        </>}
      </main>

      <BottomNav view={view} onView={(next) => { setMlbOpen(false); setView(next); }} />
      <NoahVoice ref={noahRef} />

      {hubEvent && <EventHub event={hubEvent} reminders={reminders} sheetRows={sheetRows} onClose={() => setEventHubId(null)} onEdit={() => openEventEditor(hubEvent)} onOpenCalendar={() => { setMonth(parseISO(hubEvent.date)); setEventHubId(null); setView('calendar'); }} onOpenReminders={() => { setEventHubId(null); setView('reminders'); }} onOpenSheet={() => { setEventHubId(null); setView('sheet'); }} onToggleReminder={toggleReminder} />}

      {eventEditorOpen && <EventEditor event={selectedEvent} initialDate={eventCreateDate} onClose={() => { setEventEditorOpen(false); setSelectedEvent(null); setEventCreateDate(null); }} onSave={saveEvent} />}
    </div>
  );
}
