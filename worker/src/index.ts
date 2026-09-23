import { DurableObject } from 'cloudflare:workers';
import webpush, { type PushSubscription } from 'web-push';

interface Env {
  AI: Ai;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  ASSETS: Fetcher;
}

type VapidKeys = { publicKey: string; privateKey: string };

type RemoteReminder = {
  id: string;
  title: string;
  dueAt: string;
  priority?: 'low' | 'normal' | 'high';
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  notificationEnabled?: boolean;
  done?: boolean;
  retryAt?: string;
};

type DeviceState = {
  subscription: PushSubscription;
  reminders: Record<string, RemoteReminder>;
  sent: Record<string, string>;
  updatedAt: string;
};

const VAPID_SUBJECT = 'https://dj-noa-pwa.soloaplicaciones97.workers.dev';

export class ReminderScheduler extends DurableObject<Env> {
  private async getVapidKeys(): Promise<VapidKeys> {
    const stored = await this.ctx.storage.get<VapidKeys>('vapid');
    if (stored) return stored;
    const generated = webpush.generateVAPIDKeys();
    const keys = { publicKey: generated.publicKey, privateKey: generated.privateKey };
    await this.ctx.storage.put('vapid', keys);
    return keys;
  }

  private async getDevices(): Promise<Record<string, DeviceState>> {
    return (await this.ctx.storage.get<Record<string, DeviceState>>('devices')) || {};
  }

  private async putDevices(devices: Record<string, DeviceState>) {
    await this.ctx.storage.put('devices', devices);
  }

  private effectiveTime(item: RemoteReminder) {
    return new Date(item.retryAt || item.dueAt).getTime();
  }

  private async scheduleNext(devices?: Record<string, DeviceState>) {
    const current = devices || await this.getDevices();
    const times: number[] = [];
    for (const device of Object.values(current)) {
      for (const item of Object.values(device.reminders)) {
        if (item.notificationEnabled === false || item.done || !item.dueAt) continue;
        const time = this.effectiveTime(item);
        if (Number.isFinite(time)) times.push(time);
      }
    }
    if (!times.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 500, Math.min(...times)));
  }

  private async sendPush(subscription: PushSubscription, reminder: RemoteReminder): Promise<'sent' | 'temporary' | 'dead'> {
    const vapid = await this.getVapidKeys();
    webpush.setVapidDetails(VAPID_SUBJECT, vapid.publicKey, vapid.privateKey);
    const body = JSON.stringify({
      title: reminder.priority === 'high' ? 'DJ NOA · IMPORTANTE' : 'DJ NOA',
      body: reminder.title,
      tag: `dj-noa-reminder-${reminder.id}`,
      data: { reminderId: reminder.id, url: '/', view: 'reminders' },
      icon: '/icon.svg',
      badge: '/icon.svg'
    });
    try {
      await webpush.sendNotification(subscription, body, { TTL: 3600, urgency: reminder.priority === 'high' ? 'high' : 'normal' });
      return 'sent';
    } catch (error) {
      const statusCode = error instanceof webpush.WebPushError ? error.statusCode : 0;
      if (statusCode === 404 || statusCode === 410) return 'dead';
      return 'temporary';
    }
  }

  private tokenFrom(request: Request) {
    return request.headers.get('x-dj-noa-device')?.trim() || '';
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/push/key' && request.method === 'GET') {
      const vapid = await this.getVapidKeys();
      return Response.json({ publicKey: vapid.publicKey });
    }

    if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
      const body = await request.json() as { subscription?: PushSubscription; deviceToken?: string };
      const subscription = body.subscription;
      if (!subscription?.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
        return Response.json({ error: 'invalid_subscription' }, { status: 400 });
      }

      const devices = await this.getDevices();
      let token = body.deviceToken && devices[body.deviceToken] ? body.deviceToken : '';
      if (!token) {
        token = Object.keys(devices).find((key) => devices[key].subscription.endpoint === subscription.endpoint) || crypto.randomUUID();
      }
      const previous = devices[token];
      devices[token] = {
        subscription,
        reminders: previous?.reminders || {},
        sent: previous?.sent || {},
        updatedAt: new Date().toISOString()
      };
      await this.putDevices(devices);
      await this.scheduleNext(devices);
      return Response.json({ ok: true, deviceToken: token });
    }

    if (url.pathname === '/api/reminders/sync' && request.method === 'POST') {
      const token = this.tokenFrom(request);
      const devices = await this.getDevices();
      const device = devices[token];
      if (!token || !device) return Response.json({ error: 'device_required' }, { status: 401 });

      const body = await request.json() as { reminders?: RemoteReminder[] };
      const incomingIds = new Set<string>();
      const reminders: Record<string, RemoteReminder> = {};
      for (const item of body.reminders || []) {
        if (!item?.id || !item.title || !item.dueAt || item.done || item.notificationEnabled === false) continue;
        const timestamp = new Date(item.dueAt).getTime();
        if (!Number.isFinite(timestamp)) continue;
        incomingIds.add(item.id);
        if (device.sent[item.id] === item.dueAt) continue;
        reminders[item.id] = { ...item, retryAt: undefined };
      }

      const sent = Object.fromEntries(Object.entries(device.sent).filter(([id]) => incomingIds.has(id)));
      devices[token] = { ...device, reminders, sent, updatedAt: new Date().toISOString() };
      await this.putDevices(devices);
      await this.scheduleNext(devices);
      return Response.json({ ok: true, scheduled: Object.keys(reminders).length });
    }

    if (url.pathname === '/api/push/test' && request.method === 'POST') {
      const token = this.tokenFrom(request);
      const devices = await this.getDevices();
      const device = devices[token];
      if (!token || !device) return Response.json({ error: 'device_required' }, { status: 401 });
      const result = await this.sendPush(device.subscription, {
        id: `test-${Date.now()}`,
        title: 'Notificaciones remotas funcionando.',
        dueAt: new Date().toISOString(),
        priority: 'normal'
      });
      return Response.json({ ok: result === 'sent', result }, { status: result === 'sent' ? 200 : 503 });
    }

    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    const devices = await this.getDevices();
    const now = Date.now();

    for (const [token, device] of Object.entries(devices)) {
      let subscriptionDead = false;
      for (const reminder of Object.values(device.reminders)) {
        if (this.effectiveTime(reminder) > now + 1000) continue;
        const result = await this.sendPush(device.subscription, reminder);
        if (result === 'sent') {
          device.sent[reminder.id] = reminder.dueAt;
          delete device.reminders[reminder.id];
        } else if (result === 'temporary') {
          device.reminders[reminder.id] = { ...reminder, retryAt: new Date(Date.now() + 60_000).toISOString() };
        } else {
          device.reminders[reminder.id] = { ...reminder, retryAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() };
          subscriptionDead = true;
        }
      }
      devices[token] = { ...device, updatedAt: new Date().toISOString() };
      if (subscriptionDead) devices[token].subscription = device.subscription;
    }

    await this.putDevices(devices);
    await this.scheduleNext(devices);
  }
}

const schema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['create_event', 'update_event', 'delete_event', 'create_reminder', 'update_reminder', 'delete_reminder', 'add_sheet_row', 'update_sheet_row', 'delete_sheet_row', 'add_sheet_column', 'navigate', 'query_total', 'none'] },
          eventId: { type: 'string' },
          reminderId: { type: 'string' },
          rowId: { type: 'string' },
          title: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          venue: { type: 'string' },
          address: { type: 'string' },
          notes: { type: 'string' },
          dueAt: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
          repeat: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'] },
          notificationEnabled: { type: 'boolean' },
          done: { type: 'boolean' },
          label: { type: 'string' },
          category: { type: 'string' },
          amount: { type: 'number' },
          status: { type: 'string', enum: ['confirmed', 'tentative', 'done', 'pending', 'paid', 'info'] },
          name: { type: 'string' },
          key: { type: 'string' },
          columnType: { type: 'string', enum: ['text', 'number', 'currency', 'date', 'formula'] },
          formula: { type: 'string' },
          values: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } },
          view: { type: 'string', enum: ['home', 'events', 'calendar', 'sheet', 'reminders'] },
          message: { type: 'string' }
        },
        required: ['type']
      }
    }
  },
  required: ['reply', 'actions']
};

async function handleAssistant(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { command?: string; now?: string; context?: unknown };
  if (!body.command?.trim()) return Response.json({ error: 'command_required' }, { status: 400 });

  const system = [
    'You are DJ NOA, the command interpreter for a private one-person event operations, reminders and spreadsheet app.',
    'The user speaks Spanish. Return concise Spanish.',
    'Convert the command into safe structured actions only.',
    'Dates must be ISO YYYY-MM-DD. Date-times must be ISO 8601. Times should be HH:mm.',
    'For money, return plain numeric amounts with no symbols.',
    'For existing events use exact eventId values from context. Never invent ids.',
    'For existing reminders use exact reminderId values from context. Never invent reminder ids.',
    'For existing spreadsheet rows use exact rowId values from context. Never invent row ids.',
    'For reminders, use create_reminder, update_reminder or delete_reminder. Include dueAt when a date/time is requested, priority for urgency, repeat for recurrence, and notificationEnabled only when explicitly relevant.',
    'Only delete a reminder when the user clearly asks to delete it. If the target reminder is ambiguous, return none and ask which one.',
    'Use add_sheet_row to create a new row, update_sheet_row to change a row, and delete_sheet_row only when the user explicitly asks to delete a row.',
    'Use add_sheet_column when the user asks for a new spreadsheet column. For a calculated column use columnType formula and preserve the requested formula.',
    'For update_sheet_row include only fields explicitly requested. Custom cell changes go inside values.',
    'Use query_total for questions about totals and include category/status filters when the request contains them.',
    'If a target row, reminder or event is ambiguous, return type none and ask one short follow-up.',
    'Never perform a destructive action unless the user clearly asked for it.'
  ].join(' ');

  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ command: body.command, now: body.now, context: body.context }) }
    ],
    response_format: { type: 'json_schema', json_schema: schema }
  });

  const payload = typeof result === 'object' && result && 'response' in result ? (result as { response: unknown }).response : result;
  return Response.json(payload);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/assistant' && request.method === 'POST') return handleAssistant(request, env);

    if (url.pathname.startsWith('/api/push/') || url.pathname.startsWith('/api/reminders/')) {
      const id = env.REMINDER_SCHEDULER.idFromName('personal');
      return env.REMINDER_SCHEDULER.get(id).fetch(request);
    }

    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'not_found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
