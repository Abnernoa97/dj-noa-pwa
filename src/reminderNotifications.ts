import { db } from './db';
import type { ReminderItem, ReminderRepeat } from './types';

const MAX_DELAY = 24 * 60 * 60 * 1000;
const RECENT_OVERDUE = 15 * 60 * 1000;
const DEVICE_TOKEN_KEY = 'djnoa.pushDeviceToken';

let scheduleGeneration = 0;
const activeTimers = new Set<number>();

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

function clearLocalTimers() {
  for (const timer of activeTimers) window.clearTimeout(timer);
  activeTimers.clear();
}

function addRepeat(date: Date, repeat: ReminderRepeat) {
  const next = new Date(date);
  if (repeat === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (repeat === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  if (repeat === 'monthly') {
    const day = next.getUTCDate();
    const hours = next.getUTCHours();
    const minutes = next.getUTCMinutes();
    const seconds = next.getUTCSeconds();
    const milliseconds = next.getUTCMilliseconds();
    const targetMonth = next.getUTCMonth() + 1;
    const targetYear = next.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay), hours, minutes, seconds, milliseconds));
  }
  return next;
}

function normalizedDueAt(item: ReminderItem, now = Date.now()) {
  if (!item.dueAt) return null;
  let current = new Date(item.dueAt);
  if (!Number.isFinite(current.getTime())) return null;
  const repeat = item.repeat || 'none';
  if (repeat === 'none') return current.toISOString();

  let guard = 0;
  while (current.getTime() < now - RECENT_OVERDUE && guard < 5000) {
    const next = addRepeat(current, repeat);
    if (next.getTime() <= current.getTime()) break;
    current = next;
    guard += 1;
  }
  return current.toISOString();
}

export function notificationSupport() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function ensurePushSubscription(): Promise<string | null> {
  if (!notificationSupport() || Notification.permission !== 'granted' || !navigator.onLine) return null;
  try {
    const keyResponse = await fetch(apiUrl('/api/push/key'), { cache: 'no-store' });
    if (!keyResponse.ok) return null;
    const { publicKey } = await keyResponse.json() as { publicKey?: string };
    if (!publicKey) return null;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64urlToUint8Array(publicKey).buffer as ArrayBuffer
      });
    }

    const existingToken = localStorage.getItem(DEVICE_TOKEN_KEY) || undefined;
    const response = await fetch(apiUrl('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), deviceToken: existingToken })
    });
    if (!response.ok) return null;
    const payload = await response.json() as { deviceToken?: string };
    if (!payload.deviceToken) return null;
    localStorage.setItem(DEVICE_TOKEN_KEY, payload.deviceToken);
    return payload.deviceToken;
  } catch {
    return null;
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
  const deviceToken = await ensurePushSubscription();
  if (!deviceToken) return false;

  try {
    const now = Date.now();
    const reminders = items
      .filter((item) => !item.done && item.notificationEnabled !== false && item.dueAt)
      .map((item) => ({
        id: item.id,
        title: item.title,
        dueAt: normalizedDueAt(item, now) || item.dueAt!,
        priority: item.priority || 'normal',
        repeat: item.repeat || 'none',
        notificationEnabled: true,
        done: false,
        updatedAt: item.updatedAt || item.createdAt
      }));

    const response = await fetch(apiUrl('/api/reminders/sync'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dj-noa-device': deviceToken },
      body: JSON.stringify({ reminders })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function testRemoteNotification(): Promise<boolean> {
  const deviceToken = await ensurePushSubscription();
  if (!deviceToken) return false;
  try {
    const response = await fetch(apiUrl('/api/push/test'), {
      method: 'POST',
      headers: { 'x-dj-noa-device': deviceToken }
    });
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
  const generation = ++scheduleGeneration;
  clearLocalTimers();

  if (!('Notification' in window) || Notification.permission !== 'granted') return () => undefined;

  const now = Date.now();
  for (const item of items) {
    if (item.done || item.notificationEnabled === false || !item.dueAt) continue;
    const normalized = normalizedDueAt(item, now);
    const due = normalized ? new Date(normalized).getTime() : Number.NaN;
    if (!Number.isFinite(due)) continue;

    const last = item.lastNotifiedAt ? new Date(item.lastNotifiedAt).getTime() : 0;
    if (last && Math.abs(last - due) < RECENT_OVERDUE) continue;

    const delta = due - now;
    if (delta < -RECENT_OVERDUE || delta > MAX_DELAY) continue;
    const timer = window.setTimeout(() => {
      activeTimers.delete(timer);
      void showNotification(item);
    }, Math.max(0, delta));
    activeTimers.add(timer);
  }

  void syncRemoteReminders(items).then((remoteReady) => {
    if (remoteReady && generation === scheduleGeneration) clearLocalTimers();
  });

  return () => {
    if (generation === scheduleGeneration) clearLocalTimers();
  };
}
