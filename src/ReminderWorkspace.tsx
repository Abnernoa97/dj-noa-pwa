import { useMemo, useState } from 'react';
import { Bell, Check, Clock3, Mic, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { addDays, addMonths, addWeeks, format, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { db, uid } from './db';
import { notificationSupport, requestReminderPermission } from './reminderNotifications';
import type { EventItem, ReminderItem, ReminderPriority, ReminderRepeat } from './types';

type Props = {
  items: ReminderItem[];
  events: EventItem[];
  onChanged: () => Promise<void> | void;
  onAssistant: () => void;
};

type Draft = {
  title: string;
  date: string;
  time: string;
  eventId: string;
  notes: string;
  priority: ReminderPriority;
  repeat: ReminderRepeat;
  notificationEnabled: boolean;
};

function nextOccurrence(dueAt: string, repeat: ReminderRepeat) {
  const current = parseISO(dueAt);
  const next = repeat === 'daily' ? addDays(current, 1) : repeat === 'weekly' ? addWeeks(current, 1) : repeat === 'monthly' ? addMonths(current, 1) : current;
  return next.toISOString();
}

function dueText(item: ReminderItem) {
  if (!item.dueAt) return 'Sin fecha';
  const date = parseISO(item.dueAt);
  if (isToday(date)) return `Hoy · ${format(date, 'HH:mm')}`;
  return format(date, "d MMM · HH:mm", { locale: es });
}

export default function ReminderWorkspace({ items, events, onChanged, onAssistant }: Props) {
  const [editor, setEditor] = useState<ReminderItem | null | undefined>(undefined);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => notificationSupport() ? Notification.permission : 'unsupported');

  const pending = useMemo(() => [...items].filter((item) => !item.done).sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')), [items]);
  const done = useMemo(() => [...items].filter((item) => item.done).sort((a, b) => (b.lastCompletedAt || b.updatedAt || b.createdAt).localeCompare(a.lastCompletedAt || a.updatedAt || a.createdAt)), [items]);
  const today = pending.filter((item) => item.dueAt && isToday(parseISO(item.dueAt)));
  const high = pending.filter((item) => (item.priority || 'normal') === 'high').length;

  const toggle = async (item: ReminderItem) => {
    const now = new Date().toISOString();
    const repeat = item.repeat || 'none';
    if (!item.done && repeat !== 'none' && item.dueAt) {
      await db.reminders.update(item.id, { dueAt: nextOccurrence(item.dueAt, repeat), done: false, lastCompletedAt: now, lastNotifiedAt: undefined, updatedAt: now });
    } else {
      await db.reminders.update(item.id, { done: !item.done, lastCompletedAt: !item.done ? now : item.lastCompletedAt, updatedAt: now });
    }
    await onChanged();
  };

  const remove = async (item: ReminderItem) => {
    if (!window.confirm(`¿Eliminar “${item.title}”?`)) return;
    await db.reminders.delete(item.id);
    setEditor(undefined);
    await onChanged();
  };

  const enableNotifications = async () => setPermission(await requestReminderPermission());

  return (
    <section className="page-card reminders-workspace">
      <div className="reminder-topline">
        <div><p className="eyebrow">FOCUS</p><h2>Recordatorios</h2></div>
        <button className="round-plus" onClick={() => setEditor(null)}><Plus size={20} /></button>
      </div>

      <div className="reminder-metrics">
        <div><span>HOY</span><strong>{today.length}</strong></div>
        <div><span>PENDIENTES</span><strong>{pending.length}</strong></div>
        <div><span>ALTA PRIORIDAD</span><strong>{high}</strong></div>
      </div>

      {permission !== 'granted' && (
        <button className="notification-permission" onClick={() => void enableNotifications()} disabled={permission === 'unsupported'}>
          <Bell size={16} />
          <span><strong>{permission === 'unsupported' ? 'Notificaciones no disponibles' : 'Activar notificaciones'}</strong><small>{permission === 'denied' ? 'Permiso bloqueado en el navegador' : 'DJ NOA podrá avisarte cuando llegue la hora'}</small></span>
        </button>
      )}

      <ReminderSection title="HOY" items={today} onToggle={toggle} onOpen={setEditor} />
      <ReminderSection title="PRÓXIMOS" items={pending.filter((item) => !item.dueAt || !isToday(parseISO(item.dueAt)))} onToggle={toggle} onOpen={setEditor} />
      {done.length > 0 && <ReminderSection title="COMPLETADOS" items={done.slice(0, 12)} onToggle={toggle} onOpen={setEditor} muted />}

      <div className="reminder-bottom-actions">
        <button onClick={() => setEditor(null)}><Plus size={17} /> Nuevo</button>
        <button onClick={onAssistant}><Mic size={17} /> Por voz</button>
      </div>

      {editor !== undefined && <ReminderEditor item={editor} events={events} onClose={() => setEditor(undefined)} onSaved={async () => { setEditor(undefined); await onChanged(); }} onDelete={remove} />}
    </section>
  );
}

function ReminderSection({ title, items, onToggle, onOpen, muted = false }: { title: string; items: ReminderItem[]; onToggle: (item: ReminderItem) => Promise<void>; onOpen: (item: ReminderItem) => void; muted?: boolean }) {
  if (!items.length) return null;
  return (
    <div className={`reminder-section ${muted ? 'muted' : ''}`}>
      <div className="reminder-section-title">{title}</div>
      <div className="reminder-list-editorial">
        {items.map((item) => (
          <div className={`reminder-item priority-${item.priority || 'normal'} ${item.done ? 'done' : ''}`} key={item.id}>
            <button className="reminder-check" onClick={() => void onToggle(item)} aria-label={item.done ? 'Reabrir' : 'Completar'}>{item.done ? <RotateCcw size={14} /> : <Check size={14} />}</button>
            <button className="reminder-main" onClick={() => onOpen(item)}>
              <strong>{item.title}</strong>
              <span>{dueText(item)}{item.repeat && item.repeat !== 'none' ? ` · ${item.repeat === 'daily' ? 'diario' : item.repeat === 'weekly' ? 'semanal' : 'mensual'}` : ''}</span>
            </button>
            {item.notificationEnabled !== false && <Bell className="reminder-bell" size={13} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReminderEditor({ item, events, onClose, onSaved, onDelete }: { item: ReminderItem | null; events: EventItem[]; onClose: () => void; onSaved: () => Promise<void>; onDelete: (item: ReminderItem) => Promise<void> }) {
  const parsed = item?.dueAt ? parseISO(item.dueAt) : null;
  const [draft, setDraft] = useState<Draft>({
    title: item?.title || '',
    date: parsed ? format(parsed, 'yyyy-MM-dd') : '',
    time: parsed ? format(parsed, 'HH:mm') : '',
    eventId: item?.eventId || '',
    notes: item?.notes || '',
    priority: item?.priority || 'normal',
    repeat: item?.repeat || 'none',
    notificationEnabled: item?.notificationEnabled ?? true
  });

  const save = async () => {
    if (!draft.title.trim()) return;
    const now = new Date().toISOString();
    const dueAt = draft.date ? new Date(`${draft.date}T${draft.time || '09:00'}:00`).toISOString() : undefined;
    const payload = {
      title: draft.title.trim(), dueAt, eventId: draft.eventId || undefined, notes: draft.notes.trim() || undefined,
      priority: draft.priority, repeat: draft.repeat, notificationEnabled: draft.notificationEnabled, updatedAt: now, lastNotifiedAt: undefined
    };
    if (item) await db.reminders.update(item.id, payload);
    else await db.reminders.add({ id: uid(), ...payload, done: false, createdAt: now });
    await onSaved();
  };

  const snooze = async () => {
    if (!item) return;
    const due = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.reminders.update(item.id, { dueAt: due, done: false, lastNotifiedAt: undefined, updatedAt: new Date().toISOString() });
    await onSaved();
  };

  return (
    <div className="reminder-editor-backdrop" onClick={onClose}>
      <section className="reminder-editor" onClick={(event) => event.stopPropagation()}>
        <div className="assistant-handle" />
        <div className="reminder-editor-head"><div><p className="eyebrow">{item ? 'EDITAR' : 'NUEVO'}</p><h3>{item ? item.title : 'Recordatorio'}</h3></div><button onClick={onClose}><X size={19} /></button></div>
        <div className="reminder-form">
          <label><span>TÍTULO</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej. confirmar audio" /></label>
          <div className="reminder-form-grid"><label><span>FECHA</span><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label><label><span>HORA</span><input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label></div>
          <div className="reminder-form-grid"><label><span>PRIORIDAD</span><select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as ReminderPriority })}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select></label><label><span>REPETIR</span><select value={draft.repeat} onChange={(e) => setDraft({ ...draft, repeat: e.target.value as ReminderRepeat })}><option value="none">Nunca</option><option value="daily">Diario</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label></div>
          <label><span>EVENTO</span><select value={draft.eventId} onChange={(e) => setDraft({ ...draft, eventId: e.target.value })}><option value="">Sin evento</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          <label><span>NOTAS</span><textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Información adicional" /></label>
          <label className="reminder-switch"><input type="checkbox" checked={draft.notificationEnabled} onChange={(e) => setDraft({ ...draft, notificationEnabled: e.target.checked })} /><span>Notificación activa</span></label>
        </div>
        {item && <button className="reminder-snooze" onClick={() => void snooze()}><Clock3 size={15} /> Posponer 10 min</button>}
        <div className="reminder-editor-actions">
          {item && <button className="delete-event-button" onClick={() => void onDelete(item)}><Trash2 size={16} /> Eliminar</button>}
          <button className="save-event-button" onClick={() => void save()} disabled={!draft.title.trim()}><Save size={16} /> Guardar</button>
        </div>
      </section>
    </div>
  );
}
