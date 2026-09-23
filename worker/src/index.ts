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
          type: { type: 'string', enum: ['create_event', 'create_reminder', 'add_sheet_row', 'navigate', 'query_total', 'none'] },
          title: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          venue: { type: 'string' },
          address: { type: 'string' },
          notes: { type: 'string' },
          dueAt: { type: 'string' },
          label: { type: 'string' },
          category: { type: 'string' },
          amount: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'paid', 'info'] },
          view: { type: 'string', enum: ['home', 'calendar', 'sheet', 'reminders'] },
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
    if (url.pathname !== '/api/assistant' || request.method !== 'POST') {
      return Response.json({ ok: true, service: 'DJ NOA AI' }, { headers: cors });
    }

    const body = await request.json() as { command?: string; now?: string; context?: unknown };
    if (!body.command?.trim()) return Response.json({ error: 'command_required' }, { status: 400, headers: cors });

    const system = [
      'You are DJ NOA, the command interpreter for a private one-person event operations app.',
      'The user speaks Spanish. Return concise Spanish.',
      'Convert the command into safe structured actions only.',
      'Dates must be ISO YYYY-MM-DD. Date-times must be ISO 8601.',
      'For money, return plain numeric amounts with no symbols.',
      'Never invent a destructive action because destructive actions are not supported.',
      'If information is missing, return type none and ask a short follow-up in reply.'
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
