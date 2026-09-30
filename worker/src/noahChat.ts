type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = { AI: AiBinding };
type ChatTurn = { role?: string; content?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function readText(result: unknown) {
  const value = result as {
    response?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  return String(value?.choices?.[0]?.message?.content || value?.response || '').trim();
}

export async function handleNoahChat(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await request.json() as { message?: string; history?: ChatTurn[] };
    const message = String(body?.message || '').trim().slice(0, 1200);
    if (!message) return json({ error: 'message_required' }, 400);

    const history = Array.isArray(body.history)
      ? body.history
          .slice(-10)
          .map((item) => ({
            role: item?.role === 'assistant' ? 'assistant' : 'user',
            content: String(item?.content || '').trim().slice(0, 900)
          }))
          .filter((item) => item.content)
      : [];

    const messages = [
      {
        role: 'system',
        content: 'Eres Noah, asistente de voz personal dentro de DJ NOA. Responde en español de México, natural, cálido, directo y muy breve porque la respuesta se leerá en voz alta. Mantén continuidad con la conversación. No inventes datos actuales ni afirmes que modificaste la app: esta primera versión es conversación por voz solamente y las acciones dentro de Calendario, Excel, Eventos y Tareas se añadirán después. Si te piden una acción que todavía no puedes ejecutar, dilo en una frase corta y sigue ayudando con lo que sí puedas explicar.'
      },
      ...history,
      { role: 'user', content: message }
    ];

    const result = await env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct-fast',
      {
        messages,
        temperature: 0.2,
        max_tokens: 220
      },
      { rejectIfBusy: false }
    );

    const text = readText(result);
    if (!text) return json({ error: 'empty_response' }, 503);
    return json({ text });
  } catch (error) {
    console.error('Noah chat failed', error);
    return json({ error: 'chat_unavailable' }, 503);
  }
}
