import { db } from './db';
import type { ReminderItem } from './types';

const MAX_DELAY = 24 * 60 * 60 * 1000;
const RECENT_OVERDUE = 15 * 60 * 1000;

function apiUrl(path: string) {
  return `${window.location.origin}${path}`;
}

function base64urlToUint8Array(base64url: string) {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function notificationSupport() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function ensurePushSubscription(): Promise<boolean> {
  if (!notificationSupport() || Notification.permission !== 'granted' || !navigator.onLine) return false;
  try {
    const keyResponse = await fetch(apiUrl('/api/push/key'), { cache: 'no-store' });
    if (!keyResponse.ok) return false;
    const { publicKey } = await keyResponse.json() as { publicKey?: string };
    if (!publicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64urlToUint8Array(publicKey).buffer as ArrayBuffer
      });
    }

    const response = await fetch(apiUrl('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(subscription.toJSON())
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationSupport()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await ensurePushSubscription();
  return permission;
}

export async function syncRemoteReminders(items: ReminderItem[]): Promise<boolean> {
  if (!notificationSupport() || Notification.permission !== 'granted' || !navigator.onLine) return false;
  const subscribed = await ensurePushSubscription();
  if (!subscribed) return false;

  try {
    const reminders = items
      .filter((item) => !item.done && item.notificationEnabled !== false && item.dueAt)
      .map((item) => ({
        id: item.id,
        title: item.title,
        dueAt: item.dueAt!,
        priority: item.priority || 'normal',
        repeat: item.repeat || 'none',
        notificationEnabled: true,
        done: false
      }));

    const response = await fetch(apiUrl('/api/reminders/sync'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reminders })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function testRemoteNotification(): Promise<boolean> {
  if (!(await ensurePushSubscription())) return false;
  try {
    const response = await fetch(apiUrl('/api/push/test'), { method: 'POST' });
    return response.ok;
  } catch {
    return false;
  }
}

async function showNotification(item: ReminderItem) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('DJ NOA', {
      body: item.title,
      tag: `dj-noa-reminder-${item.id}`,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { reminderId: item.id, url: '/', view: 'reminders' }
    });
    await db.reminders.update(item.id, { lastNotifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  } catch {
    // Local notification errors never block the app.
  }
}

export function scheduleReminderNotifications(items: ReminderItem[]) {
  const timers: number[] = [];
  if (!('Notification' in window) || Notification.permission !== 'granted') return () => undefined;

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

  void syncRemoteReminders(items).then((remoteReady) => {
    if (remoteReady) timers.forEach((timer) => window.clearTimeout(timer));
  });

  return () => timers.forEach((timer) => window.clearTimeout(timer));
}
