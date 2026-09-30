type AnyRecord = Record<string, unknown>;

type Sport = 'MLB' | 'NBA';
type BookView = { provider: string; away: number; home: number };
type TeamView = { name: string; abbreviation: string; logo?: string; score?: string };
type GameView = {
  id: string;
  startTime: string;
  status: 'scheduled' | 'live' | 'final';
  statusText: string;
  venue?: string;
  away: TeamView;
  home: TeamView;
  consensusAway?: number;
  consensusHome?: number;
  books: BookView[];
};
type FormGame = { date: string; result: 'W' | 'L'; opponent: string; score?: string };
type FormView = {
  last5: { wins: number; losses: number; sequence: string[] };
  last10: { wins: number; losses: number; sequence: string[] };
  games: FormGame[];
  sourceSeason?: number;
};

type Lineups = { away: string[]; home: string[]; status: 'published' | 'unavailable' };

type LiveResponse = {
  updatedAt: string;
  game?: GameView;
  form?: { away: FormView | null; home: FormView | null };
  probablePitchers?: { away?: string; home?: string };
  lineups?: Lineups;
  warnings: string[];
};

function rec(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function dateOnly(value: string) { return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''; }
function alias(value: string) {
  const key = value.toUpperCase();
  const aliases: Record<string, string> = { CWS: 'CHW', CHW: 'CHW', KC: 'KC', KCR: 'KC', SF: 'SF', SFG: 'SF', SD: 'SD', SDP: 'SD', TB: 'TB', TBR: 'TB', WSH: 'WSH', WSN: 'WSH' };
  return aliases[key] || key;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'DJ-NOA/1.0' } });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return response.json();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function teamMatches(team: AnyRecord, queryName: string, queryAbbr: string) {
  const name = str(team.displayName) || str(team.name) || str(team.teamName) || str(team.shortDisplayName);
  const supplied = str(team.abbreviation) || str(team.abbrev) || str(team.teamTricode);
  const byAbbr = alias(supplied) === alias(queryAbbr);
  const n1 = normalize(name);
  const n2 = normalize(queryName);
  return Boolean(byAbbr || (n1 && n2 && (n1 === n2 || n1.includes(n2) || n2.includes(n1))));
}

function statusView(value: unknown) {
  const status = rec(value);
  const type = rec(status.type);
  const state = str(type.state).toLowerCase();
  const detail = str(type.shortDetail) || str(type.detail) || str(status.displayClock);
  if (state === 'in') return { status: 'live' as const, statusText: detail || 'EN VIVO' };
  if (state === 'post') return { status: 'final' as const, statusText: detail || 'FINAL' };
  return { status: 'scheduled' as const, statusText: detail || 'PROGRAMADO' };
}

function teamView(value: AnyRecord): TeamView {
  const team = rec(value.team);
  const name = str(team.displayName) || str(team.name) || str(team.shortDisplayName) || 'Equipo';
  return {
    name,
    abbreviation: (str(team.abbreviation) || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3)).toUpperCase(),
    logo: str(team.logo) || undefined,
    score: str(value.score) || undefined
  };
}

function marketMoneyLine(item: AnyRecord, side: 'away' | 'home') {
  const teamOdds = rec(side === 'away' ? item.awayTeamOdds : item.homeTeamOdds);
  return num(teamOdds.moneyLine)
    ?? num(teamOdds.moneyline)
    ?? num(item[`${side}MoneyLine`])
    ?? num(item[`${side}Moneyline`]);
}

function marketsFrom(value: unknown): BookView[] {
  const rows = new Map<string, BookView>();
  for (const raw of list(value)) {
    const item = rec(raw);
    const away = marketMoneyLine(item, 'away');
    const home = marketMoneyLine(item, 'home');
    if (away === undefined || home === undefined || away === 0 || home === 0) continue;
    const provider = rec(item.provider);
    const providerName = str(provider.name) || str(provider.displayName) || str(item.providerName) || 'Mercado';
    const key = providerName.trim().toLowerCase();
    if (!rows.has(key)) rows.set(key, { provider: providerName, away, home });
  }
  return Array.from(rows.values()).slice(0, 5);
}

function impliedProbability(american: number) {
  return american < 0 ? (-american) / ((-american) + 100) : 100 / (american + 100);
}

function americanFromProbability(probability: number) {
  if (!(probability > 0 && probability < 1)) return undefined;
  return Math.round(probability >= 0.5 ? -(100 * probability) / (1 - probability) : (100 * (1 - probability)) / probability);
}

function consensus(books: BookView[]) {
  if (!books.length) return {};
  if (books.length === 1) return { away: books[0].away, home: books[0].home };
  const away = books.reduce((sum, book) => sum + impliedProbability(book.away), 0) / books.length;
  const home = books.reduce((sum, book) => sum + impliedProbability(book.home), 0) / books.length;
  return { away: americanFromProbability(away), home: americanFromProbability(home) };
}

function competitionFrom(value: unknown) {
  const root = rec(value);
  const header = rec(root.header);
  const headerCompetition = rec(list(header.competitions)[0]);
  if (Object.keys(headerCompetition).length) return headerCompetition;
  return rec(list(root.competitions)[0]);
}

function parseEspnGame(payload: unknown, fallbackEvent?: AnyRecord): GameView | undefined {
  const root = rec(payload);
  const competition = competitionFrom(root);
  const fallbackCompetition = rec(list(rec(fallbackEvent).competitions)[0]);
  const activeCompetition = Object.keys(competition).length ? competition : fallbackCompetition;
  const competitors = list(activeCompetition.competitors).map(rec);
  const awayRaw = competitors.find((item) => str(item.homeAway) === 'away');
  const homeRaw = competitors.find((item) => str(item.homeAway) === 'home');
  if (!awayRaw || !homeRaw) return undefined;

  const event = Object.keys(rec(fallbackEvent)).length ? rec(fallbackEvent) : rec(root.header);
  const books = marketsFrom(root.pickcenter).length
    ? marketsFrom(root.pickcenter)
    : marketsFrom(activeCompetition.odds);
  const market = consensus(books);
  const status = statusView(rec(root.header).competitions ? activeCompetition.status : rec(event.status));
  const venue = rec(activeCompetition.venue);
  return {
    id: str(rec(fallbackEvent).id) || str(rec(root.header).id) || str(activeCompetition.id) || crypto.randomUUID(),
    startTime: str(rec(fallbackEvent).date) || str(activeCompetition.date) || str(rec(root.header).date),
    status: status.status,
    statusText: status.statusText,
    venue: str(venue.fullName) || undefined,
    away: teamView(awayRaw),
    home: teamView(homeRaw),
    consensusAway: market.away,
    consensusHome: market.home,
    books
  };
}

function findEvent(payload: unknown, awayName: string, awayAbbr: string, homeName: string, homeAbbr: string) {
  for (const raw of list(rec(payload).events)) {
    const event = rec(raw);
    const competition = rec(list(event.competitions)[0]);
    const competitors = list(competition.competitors).map(rec);
    const away = competitors.find((item) => str(item.homeAway) === 'away');
    const home = competitors.find((item) => str(item.homeAway) === 'home');
    if (!away || !home) continue;
    if (teamMatches(rec(away.team), awayName, awayAbbr) && teamMatches(rec(home.team), homeName, homeAbbr)) return event;
  }
  return undefined;
}

async function loadEspnLiveGame(sport: Sport, date: string, awayName: string, awayAbbr: string, homeName: string, homeAbbr: string): Promise<GameView | undefined> {
  const path = sport === 'MLB' ? 'baseball/mlb' : 'basketball/nba';
  const compact = date.replaceAll('-', '');
  const urls = sport === 'MLB'
    ? [`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${compact}&limit=100&seasontype=3`, `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${compact}&limit=100`]
    : [`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${compact}&limit=100`];

  for (const url of urls) {
    try {
      const payload = await getJson(url);
      const event = findEvent(payload, awayName, awayAbbr, homeName, homeAbbr);
      if (!event) continue;
      const id = str(event.id);
      if (id) {
        try {
          const summary = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(id)}`);
          const parsed = parseEspnGame(summary, event);
          if (parsed) return parsed;
        } catch {
          // Scoreboard still provides status/score when summary is temporarily unavailable.
        }
      }
      const parsed = parseEspnGame({ competitions: list(event.competitions) }, event);
      if (parsed) return parsed;
    } catch {
      // Try the next ESPN feed.
    }
  }
  return undefined;
}

function aggregateForm(games: FormGame[], sourceSeason: number): FormView | null {
  const recent = games.slice(0, 10);
  if (!recent.length) return null;
  const aggregate = (items: FormGame[]) => ({
    wins: items.filter((game) => game.result === 'W').length,
    losses: items.filter((game) => game.result === 'L').length,
    sequence: items.map((game) => game.result)
  });
  return { last5: aggregate(recent.slice(0, 5)), last10: aggregate(recent), games: recent, sourceSeason };
}

async function resolveMlbTeamId(name: string, abbreviation: string, season: number): Promise<number | undefined> {
  const payload = rec(await getJson(`https://statsapi.mlb.com/api/v1/teams?sportId=1&season=${season}`));
  for (const raw of list(payload.teams)) {
    const team = rec(raw);
    if (!teamMatches(team, name, abbreviation)) continue;
    const id = num(team.id);
    if (id !== undefined) return Math.trunc(id);
  }
  return undefined;
}

async function loadMlbForm(name: string, abbreviation: string, targetDate: string): Promise<FormView | null> {
  const season = Number(targetDate.slice(0, 4));
  const teamId = await resolveMlbTeamId(name, abbreviation, season);
  if (!teamId) return null;
  const startDate = shiftDate(targetDate, -55);
  const payload = rec(await getJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${startDate}&endDate=${targetDate}&hydrate=team`));
  const games: FormGame[] = [];
  for (const rawDate of list(payload.dates)) {
    for (const rawGame of list(rec(rawDate).games)) {
      const game = rec(rawGame);
      const status = rec(game.status);
      if (str(status.abstractGameState).toLowerCase() !== 'final') continue;
      const teams = rec(game.teams);
      const away = rec(teams.away);
      const home = rec(teams.home);
      const awayTeam = rec(away.team);
      const homeTeam = rec(home.team);
      const mineAway = num(awayTeam.id) === teamId;
      const mine = mineAway ? away : home;
      const opponent = mineAway ? home : away;
      const myScore = num(mine.score);
      const theirScore = num(opponent.score);
      if (myScore === undefined || theirScore === undefined || myScore === theirScore) continue;
      const opponentTeam = rec(opponent.team);
      games.push({
        date: dateOnly(str(game.gameDate)) || str(rec(rawDate).date),
        result: myScore > theirScore ? 'W' : 'L',
        opponent: str(opponentTeam.name) || 'Rival',
        score: `${Math.trunc(myScore)}-${Math.trunc(theirScore)}`
      });
    }
  }
  games.sort((a, b) => b.date.localeCompare(a.date));
  return aggregateForm(games, season);
}

function playerName(value: unknown) {
  const item = rec(value);
  return str(item.fullName) || str(item.displayName) || str(item.name);
}

function lineupFromBoxscoreSide(side: AnyRecord) {
  const players = rec(side.players);
  const order = list(side.battingOrder).map((value) => String(value));
  const names: string[] = [];
  for (const rawId of order) {
    const key = rawId.startsWith('ID') ? rawId : `ID${rawId}`;
    const player = rec(players[key]);
    const name = playerName(player.person);
    if (name) names.push(name);
  }
  return names.slice(0, 9);
}

async function loadMlbGameContext(date: string, awayName: string, awayAbbr: string, homeName: string, homeAbbr: string) {
  const schedule = rec(await getJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=probablePitcher,team`));
  const games = list(rec(list(schedule.dates)[0]).games).map(rec);
  const game = games.find((candidate) => {
    const teams = rec(candidate.teams);
    return teamMatches(rec(rec(teams.away).team), awayName, awayAbbr) && teamMatches(rec(rec(teams.home).team), homeName, homeAbbr);
  });
  if (!game) return { probablePitchers: {}, lineups: { away: [], home: [], status: 'unavailable' as const } };
  const teams = rec(game.teams);
  const awayPitcher = playerName(rec(teams.away).probablePitcher);
  const homePitcher = playerName(rec(teams.home).probablePitcher);
  const gamePk = num(game.gamePk);
  let awayLineup: string[] = [];
  let homeLineup: string[] = [];
  if (gamePk !== undefined) {
    try {
      const boxscore = rec(await getJson(`https://statsapi.mlb.com/api/v1/game/${Math.trunc(gamePk)}/boxscore`));
      const boxTeams = rec(boxscore.teams);
      awayLineup = lineupFromBoxscoreSide(rec(boxTeams.away));
      homeLineup = lineupFromBoxscoreSide(rec(boxTeams.home));
    } catch {
      // Lineups may not be published yet.
    }
  }
  return {
    probablePitchers: { away: awayPitcher || undefined, home: homePitcher || undefined },
    lineups: { away: awayLineup, home: homeLineup, status: awayLineup.length || homeLineup.length ? 'published' as const : 'unavailable' as const }
  };
}

export async function handleSportsLive(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(request.url);
  const sport = str(url.searchParams.get('sport')).toUpperCase() as Sport;
  const date = dateOnly(str(url.searchParams.get('date')));
  const away = str(url.searchParams.get('away')).toUpperCase();
  const home = str(url.searchParams.get('home')).toUpperCase();
  const awayName = str(url.searchParams.get('awayName'));
  const homeName = str(url.searchParams.get('homeName'));
  if (!['MLB', 'NBA'].includes(sport) || !date || !away || !home) return json({ error: 'invalid_request' }, 400);

  const warnings: string[] = [];
  const response: LiveResponse = { updatedAt: new Date().toISOString(), warnings };

  try {
    response.game = await loadEspnLiveGame(sport, date, awayName, away, homeName, home);
    if (!response.game) warnings.push('live_game_not_found');
  } catch {
    warnings.push('live_game_unavailable');
  }

  if (sport === 'MLB') {
    const [awayForm, homeForm, context] = await Promise.allSettled([
      loadMlbForm(awayName, away, date),
      loadMlbForm(homeName, home, date),
      loadMlbGameContext(date, awayName, away, homeName, home)
    ]);
    response.form = {
      away: awayForm.status === 'fulfilled' ? awayForm.value : null,
      home: homeForm.status === 'fulfilled' ? homeForm.value : null
    };
    if (awayForm.status === 'rejected') warnings.push('away_form_unavailable');
    if (homeForm.status === 'rejected') warnings.push('home_form_unavailable');
    if (context.status === 'fulfilled') {
      response.probablePitchers = context.value.probablePitchers;
      response.lineups = context.value.lineups;
    } else {
      warnings.push('mlb_context_unavailable');
    }
  }

  return json(response);
}
