interface Env {
  AI: Ai;
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

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname !== '/api/assistant' || request.method !== 'POST') return Response.json({ ok: true, service: 'DJ NOA AI' }, { headers: cors });

    const body = await request.json() as { command?: string; now?: string; context?: unknown };
    if (!body.command?.trim()) return Response.json({ error: 'command_required' }, { status: 400, headers: cors });

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
    return Response.json(payload, { headers: cors });
  }
};