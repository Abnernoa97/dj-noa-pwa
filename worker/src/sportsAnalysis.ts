type AnyRecord = Record<string, unknown>;

type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = { AI: AiBinding };

function rec(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function list(value: unknown) { return Array.isArray(value) ? value : []; }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }

function normalizeAnalysis(value: unknown) {
  const data = rec(value);
  const result = rec(data.response ?? data.result ?? data);
  const risks = list(result.risks).map((item) => str(item)).filter(Boolean).slice(0, 4);
  const summary = str(result.summary).trim();
  const market = str(result.market).trim();
  const edge = str(result.edge).trim();
  if (!summary || !market || !edge) return null;
  return { summary, market, edge, risks };
}

function extractJsonText(value: unknown) {
  const data = rec(value);
  const candidates = [
    str(data.response), str(data.result), str(data.output_text), str(data.text),
    str(rec(data.response).text), str(rec(data.result).text)
  ].filter(Boolean);
  return candidates[0] || '';
}

export async function handleSportsAnalysis(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let body: AnyRecord;
  try { body = rec(await request.json()); } catch { return json({ error: 'invalid_json' }, 400); }

  const sport = str(body.sport).toUpperCase();
  const game = rec(body.game);
  if (!['MLB', 'NBA'].includes(sport) || !Object.keys(game).length) return json({ error: 'invalid_request' }, 400);

  const away = rec(game.away);
  const home = rec(game.home);
  const books = list(game.books).slice(0, 5);
  const sportsContext = rec(body.sportsContext);
  const context = {
    sport,
    matchup: `${str(away.name) || str(away.abbreviation)} vs ${str(home.name) || str(home.abbreviation)}`,
    status: str(game.status),
    statusText: str(game.statusText),
    startTime: str(game.startTime),
    venue: str(game.venue),
    consensusAway: game.consensusAway,
    consensusHome: game.consensusHome,
    books,
    awayStanding: body.awayStanding ?? null,
    homeStanding: body.homeStanding ?? null,
    verifiedContext: Object.keys(sportsContext).length ? sportsContext : null
  };

  const prompt = `Eres DJ NOA Sports, un analista neutral de datos deportivos y mercado. Analiza SOLO la información suministrada. No inventes lesiones, pitchers, lineups, jugadores ni estadísticas ausentes. Si un dato no está disponible, dilo claramente. No garantices resultados ni presentes una apuesta como segura. Explica qué está favoreciendo el mercado, la forma reciente, información de disponibilidad publicada y los riesgos. Responde exclusivamente JSON válido con: {"summary":"2-3 frases en español","market":"1 frase","edge":"1 frase descriptiva, sin recomendar apostar","risks":["riesgo 1","riesgo 2"]}. Datos: ${JSON.stringify(context)}`;

  try {
    const output = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'Devuelve exclusivamente JSON válido. Sé preciso, neutral y conservador. Nunca inventes datos deportivos.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.15,
      max_tokens: 600
    }, { rejectIfBusy: false });

    const direct = normalizeAnalysis(output);
    if (direct) return json(direct);

    const text = extractJsonText(output).replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        const normalized = normalizeAnalysis(parsed);
        if (normalized) return json(normalized);
      } catch { /* fall through */ }
    }
    return json({ error: 'analysis_invalid' }, 502);
  } catch (error) {
    console.error('DJ NOA sports analysis error', error);
    return json({ error: 'analysis_unavailable' }, 503);
  }
}
