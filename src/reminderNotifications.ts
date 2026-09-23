import { db } from './db';
import type { ReminderItem } from './types';

const MAX_DELAY = 24 * 60 * 60 * 1000;
const RECENT_OVERDUE = 15 * 60 * 1000;

export function notificationSupport() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationSupport()) return 'unsupported';
  return Notification.requestPermission();
}

async function showNotification(item: ReminderItem) {
  if (!notificationSupport() || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('DJ NOA', {
        body: item.title,
        tag: `dj-noa-reminder-${item.id}`,
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: { reminderId: item.id, url: './' }
      });
    } else {
      new Notification('DJ NOA', { body: item.title, icon: '/icon.svg', tag: `dj-noa-reminder-${item.id}` });
    }
    await db.reminders.update(item.id, { lastNotifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  } catch {
    // Notification errors should never block the app.
  }
}

export function scheduleReminderNotifications(items: ReminderItem[]) {
  const timers: number[] = [];
  if (!notificationSupport() || Notification.permission !== 'granted') return () => undefined;

  const now = Date.now();
  for (const item of items) {
    if (item.done || item.notificationEnabled === false || !item.dueAt) continue;
    const due = new Date(item.dueAt).getTime();
    if (!Number.isFinite(due)) continue;

    const last = item.lastNotifiedAt ? new Date(item.lastNotifiedAt).getTime() : 0;
    if (last && Math.abs(last - due) < RECENT_OVERDUE) continue;

    const delta = due - now;
    if (delta < -RECENT_OVERDUE || delta > MAX_DELAY) continue;
    const timer = window.setTimeout(() => void showNotification(item), Math.max(0, delta));
    timers.push(timer);
  }

  return () => timers.forEach((timer) => window.clearTimeout(timer));
}
