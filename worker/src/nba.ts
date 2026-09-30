type AnyRecord = Record<string, unknown>;

type TeamView = { name: string; abbreviation: string; logo?: string; score?: string };
type BookView = { provider: string; away: number; home: number };
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
type StandingView = {
  conference: 'EAST' | 'WEST';
  team: string;
  abbreviation: string;
  wins: number;
  losses: number;
  pct: string;
  gamesBack: string;
  rank: number;
};

const NBA_HEADERS: HeadersInit = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  origin: 'https://www.nba.com',
  referer: 'https://www.nba.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

function rec(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}
function int(value: unknown, fallback = 0) { const parsed = num(value); return parsed === undefined ? fallback : Math.trunc(parsed); }
function abbr(name: string, supplied?: string) { return supplied?.trim().toUpperCase() || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase(); }

function nextDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return '';
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

async function getJson(url: string, nbaHeaders = false): Promise<unknown> {
  const response = await fetch(url, { headers: nbaHeaders ? NBA_HEADERS : { accept: 'application/json' } });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('json')) {
    const text = await response.text();
    try { return JSON.parse(text); } catch { throw new Error('upstream_not_json'); }
  }
  return response.json();
}

async function firstJson(urls: string[], nbaHeaders = false) {
  let lastError: unknown;
  for (const url of urls) {
    try { return await getJson(url, nbaHeaders); } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('upstream_unavailable');
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

function officialStatus(game: AnyRecord) {
  const raw = int(game.gameStatus);
  const text = str(game.gameStatusText) || str(game.gameStatusTextLong);
  if (raw === 2) return { status: 'live' as const, statusText: text || 'EN VIVO' };
  if (raw === 3) return { status: 'final' as const, statusText: text || 'FINAL' };
  return { status: 'scheduled' as const, statusText: text || 'PROGRAMADO' };
}

function teamView(value: AnyRecord): TeamView {
  const team = rec(value.team);
  const name = str(team.displayName) || str(team.name) || str(team.shortDisplayName) || 'Equipo';
  return { name, abbreviation: abbr(name, str(team.abbreviation)), logo: str(team.logo) || undefined, score: str(value.score) || undefined };
}

function officialTeamView(value: AnyRecord): TeamView {
  const city = str(value.teamCity);
  const nameOnly = str(value.teamName) || str(value.teamNickname);
  const name = [city, nameOnly].filter(Boolean).join(' ').trim() || str(value.teamName) || 'Equipo';
  const abbreviation = abbr(name, str(value.teamTricode) || str(value.tricode) || str(value.teamCode));
  return {
    name,
    abbreviation,
    logo: `https://a.espncdn.com/i/teamlogos/nba/500/${abbreviation.toLowerCase()}.png`,
    score: value.score === undefined || value.score === null ? undefined : String(value.score)
  };
}

function marketMoneyLine(item: AnyRecord, side: 'away' | 'home') {
  const teamOdds = rec(side === 'away' ? item.awayTeamOdds : item.homeTeamOdds);
  return num(teamOdds.moneyLine)
    ?? num(teamOdds.moneyline)
    ?? num(item[`${side}MoneyLine`])
    ?? num(item[`${side}Moneyline`]);
}

function marketView(competition: AnyRecord): BookView[] {
  const rows = new Map<string, BookView>();
  for (const raw of list(competition.odds)) {
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
  const american = probability >= 0.5
    ? -(100 * probability) / (1 - probability)
    : (100 * (1 - probability)) / probability;
  return Math.round(american);
}

function decimalToAmerican(decimal: number) {
  if (!(decimal > 1)) return undefined;
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

function marketConsensus(books: BookView[]) {
  if (!books.length) return {};
  if (books.length === 1) return { away: books[0].away, home: books[0].home };
  const awayProbability = books.reduce((sum, book) => sum + impliedProbability(book.away), 0) / books.length;
  const homeProbability = books.reduce((sum, book) => sum + impliedProbability(book.home), 0) / books.length;
  return { away: americanFromProbability(awayProbability), home: americanFromProbability(homeProbability) };
}

async function loadOfficialOdds(): Promise<Map<string, BookView[]>> {
  const payload = rec(await getJson('https://cdn.nba.com/static/json/liveData/odds/odds_todaysGames.json', true));
  const result = new Map<string, BookView[]>();
  const rawGames = list(payload.games).flatMap((item) => Array.isArray(item) ? item : [item]).map(rec);
  for (const game of rawGames) {
    const gameId = str(game.gameId);
    if (!gameId) continue;
    const books: BookView[] = [];
    for (const rawMarket of list(game.markets)) {
      const market = rec(rawMarket);
      const marketName = str(market.name).toLowerCase();
      if (marketName && !marketName.includes('2way') && !marketName.includes('money')) continue;
      for (const rawBook of list(market.books)) {
        const book = rec(rawBook);
        let away: number | undefined;
        let home: number | undefined;
        for (const rawOutcome of list(book.outcomes)) {
          const outcome = rec(rawOutcome);
          const american = num(outcome.american_odds)
            ?? num(outcome.americanOdds)
            ?? decimalToAmerican(num(outcome.odds) || 0);
          if (american === undefined) continue;
          const type = str(outcome.type).toLowerCase();
          if (type === 'away') away = american;
          if (type === 'home') home = american;
        }
        if (away === undefined || home === undefined) continue;
        books.push({ provider: str(book.name) || 'NBA Market', away, home });
        if (books.length >= 5) break;
      }
      if (books.length) break;
    }
    if (books.length) result.set(gameId, books);
  }
  return result;
}

function officialGameView(game: AnyRecord, books: BookView[] = []): GameView | null {
  const awayRaw = rec(game.awayTeam);
  const homeRaw = rec(game.homeTeam);
  if (!Object.keys(awayRaw).length || !Object.keys(homeRaw).length) return null;
  const status = officialStatus(game);
  const consensus = marketConsensus(books);
  const arena = rec(game.arena);
  return {
    id: str(game.gameId) || crypto.randomUUID(),
    startTime: str(game.gameDateTimeUTC) || str(game.gameDateTimeEst) || str(game.gameDate) || '',
    status: status.status,
    statusText: status.statusText,
    venue: str(arena.arenaName) || str(game.arenaName) || undefined,
    away: officialTeamView(awayRaw),
    home: officialTeamView(homeRaw),
    consensusAway: consensus.away,
    consensusHome: consensus.home,
    books
  };
}

async function loadOfficialTodayGames(date: string): Promise<GameView[]> {
  const [scorePayload, oddsResult] = await Promise.all([
    getJson('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json', true),
    loadOfficialOdds().catch(() => new Map<string, BookView[]>())
  ]);
  const scoreboard = rec(rec(scorePayload).scoreboard);
  if (normalizeDate(str(scoreboard.gameDate)) !== date) return [];
  return list(scoreboard.games)
    .map(rec)
    .map((game) => officialGameView(game, oddsResult.get(str(game.gameId)) || []))
    .filter(Boolean) as GameView[];
}

function gameDateFromOfficial(gameDateGroup: AnyRecord, game: AnyRecord) {
  return normalizeDate(str(game.gameDateTimeUTC))
    || normalizeDate(str(game.gameDate))
    || normalizeDate(str(gameDateGroup.gameDate));
}

async function loadOfficialScheduleGames(date: string): Promise<GameView[]> {
  const payload = rec(await firstJson([
    'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json',
    'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json',
    'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_9.json'
  ], true));
  const leagueSchedule = rec(payload.leagueSchedule);
  const rawGames: AnyRecord[] = [];
  for (const rawGroup of list(leagueSchedule.gameDates)) {
    const group = rec(rawGroup);
    for (const rawGame of list(group.games)) {
      const game = rec(rawGame);
      if (gameDateFromOfficial(group, game) === date) rawGames.push(game);
    }
  }
  const oddsResult = await loadOfficialOdds().catch(() => new Map<string, BookView[]>());
  return rawGames
    .map((game) => officialGameView(game, oddsResult.get(str(game.gameId)) || []))
    .filter(Boolean) as GameView[];
}

async function loadEspnGames(date: string): Promise<GameView[]> {
  const compact = date.replaceAll('-', '');
  const payload = rec(await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${compact}&limit=100`));
  const games = list(payload.events).map((raw) => {
    const event = rec(raw);
    const competition = rec(list(event.competitions)[0]);
    const competitors = list(competition.competitors).map(rec);
    const awayRaw = competitors.find((item) => str(item.homeAway) === 'away');
    const homeRaw = competitors.find((item) => str(item.homeAway) === 'home');
    if (!awayRaw || !homeRaw) return null;
    const books = marketView(competition);
    const consensus = marketConsensus(books);
    const status = statusView(event.status);
    const venue = rec(competition.venue);
    return {
      id: str(event.id) || crypto.randomUUID(),
      startTime: str(event.date),
      status: status.status,
      statusText: status.statusText,
      venue: str(venue.fullName) || undefined,
      away: teamView(awayRaw),
      home: teamView(homeRaw),
      consensusAway: consensus.away,
      consensusHome: consensus.home,
      books
    } satisfies GameView;
  }).filter(Boolean) as GameView[];
  return games;
}

async function loadGames(date: string): Promise<GameView[]> {
  try {
    const espn = await loadEspnGames(date);
    if (espn.length) return sortGames(espn);
  } catch {
    // Continue to official NBA sources.
  }

  try {
    const today = await loadOfficialTodayGames(date);
    if (today.length) return sortGames(today);
  } catch {
    // The live CDN may not match the requested date.
  }

  const schedule = await loadOfficialScheduleGames(date);
  return sortGames(schedule);
}

function sortGames(games: GameView[]) {
  return [...games].sort((a, b) => {
    const aTime = new Date(a.startTime).getTime();
    const bTime = new Date(b.startTime).getTime();
    return (Number.isFinite(aTime) ? aTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bTime) ? bTime : Number.MAX_SAFE_INTEGER);
  });
}

function stat(entry: AnyRecord, names: string[]) {
  const stats = list(entry.stats).map(rec);
  for (const name of names) {
    const found = stats.find((item) => str(item.name).toLowerCase() === name.toLowerCase() || str(item.abbreviation).toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  return {} as AnyRecord;
}

function statNumber(entry: AnyRecord, names: string[], fallback = 0) {
  const item = stat(entry, names);
  return int(item.value ?? item.displayValue, fallback);
}

function statText(entry: AnyRecord, names: string[], fallback = '-') {
  const item = stat(entry, names);
  const display = str(item.displayValue);
  if (display) return display;
  const value = num(item.value);
  return value === undefined ? fallback : String(value);
}

function conferenceFromName(name: string): 'EAST' | 'WEST' | null {
  if (/east/i.test(name)) return 'EAST';
  if (/west/i.test(name)) return 'WEST';
  return null;
}

async function standingsFromEspn(season: number): Promise<StandingView[]> {
  const payload = rec(await getJson(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${season}`));
  const rows: StandingView[] = [];
  for (const rawGroup of list(payload.children)) {
    const group = rec(rawGroup);
    const conference = conferenceFromName(str(group.name) || str(group.abbreviation));
    if (!conference) continue;
    const standings = rec(group.standings);
    for (const rawEntry of list(standings.entries)) {
      const entry = rec(rawEntry);
      const team = rec(entry.team);
      const name = str(team.displayName) || str(team.name) || 'Equipo';
      const wins = statNumber(entry, ['wins', 'W']);
      const losses = statNumber(entry, ['losses', 'L']);
      const pctRaw = statText(entry, ['winPercent', 'PCT'], '.000');
      const pctNumber = Number(pctRaw);
      const pct = Number.isFinite(pctNumber) ? pctNumber.toFixed(3).replace(/^0/, '') : pctRaw;
      const gamesBack = statText(entry, ['gamesBehind', 'GB'], '-');
      const rank = statNumber(entry, ['playoffSeed', 'seed', 'rank'], rows.filter((row) => row.conference === conference).length + 1);
      rows.push({ conference, team: name, abbreviation: abbr(name, str(team.abbreviation)), wins, losses, pct, gamesBack, rank });
    }
  }
  return rows;
}

async function standingsFromOfficialCdn(): Promise<StandingView[]> {
  const payload = rec(await firstJson([
    'https://cdn.nba.com/static/json/current/standings_all.json',
    'https://cdn.nba.com/static/json/current/standings_all_no_sort_keys.json'
  ], true));
  const standard = rec(rec(payload.league).standard);
  const rows: StandingView[] = [];
  for (const rawTeam of list(standard.teams)) {
    const team = rec(rawTeam);
    const sites = rec(team.teamSitesOnly);
    const conference = conferenceFromName(
      str(team.confName) || str(team.conference) || str(sites.confName) || str(sites.conference)
    );
    if (!conference) continue;
    const abbreviation = abbr(
      str(team.fullName) || str(sites.teamName) || 'Equipo',
      str(team.tricode) || str(team.teamTricode) || str(sites.teamTricode) || str(sites.tricode)
    );
    const city = str(team.teamCity) || str(sites.teamCity);
    const nickname = str(team.teamName) || str(team.nickname) || str(sites.teamName) || str(sites.nickname);
    const name = [city, nickname].filter(Boolean).join(' ').trim() || abbreviation;
    const wins = int(team.win ?? team.wins ?? sites.win ?? sites.wins);
    const losses = int(team.loss ?? team.losses ?? sites.loss ?? sites.losses);
    const rawPct = str(team.winPct) || str(team.pct) || str(sites.winPct) || str(sites.pct);
    const pctNumber = Number(rawPct);
    const pct = Number.isFinite(pctNumber) ? pctNumber.toFixed(3).replace(/^0/, '') : rawPct || '.000';
    const gamesBack = str(team.gamesBehind) || str(team.gb) || str(sites.gamesBehind) || str(sites.gb) || '-';
    const rank = int(team.confRank ?? team.conferenceRank ?? sites.confRank ?? sites.conferenceRank, rows.filter((row) => row.conference === conference).length + 1);
    rows.push({ conference, team: name, abbreviation, wins, losses, pct, gamesBack, rank });
  }
  return rows.sort((a, b) => a.conference.localeCompare(b.conference) || a.rank - b.rank);
}

function nbaSeasonForDate(date: string) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 9 ? year + 1 : year;
}

async function loadStandings(date: string) {
  const season = nbaSeasonForDate(date);
  try {
    const current = await standingsFromEspn(season);
    if (current.length) return current;
  } catch {
    // Continue to the official NBA CDN.
  }

  try {
    const official = await standingsFromOfficialCdn();
    if (official.length) return official;
  } catch {
    // Continue to previous season as the last stable reference.
  }

  try {
    return await standingsFromEspn(season - 1);
  } catch {
    return [];
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function handleNbaRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'invalid_date' }, 400);

  const next = nextDate(date);
  const [gamesResult, nextGamesResult, standingsResult] = await Promise.allSettled([
    loadGames(date),
    loadGames(next),
    loadStandings(date)
  ]);

  const warnings: string[] = [];
  if (gamesResult.status === 'rejected') warnings.push('games_unavailable');
  if (nextGamesResult.status === 'rejected') warnings.push('next_games_unavailable');
  if (standingsResult.status === 'rejected') warnings.push('standings_unavailable');

  return json({
    date,
    nextDate: next,
    updatedAt: new Date().toISOString(),
    season: nbaSeasonForDate(date),
    games: gamesResult.status === 'fulfilled' ? gamesResult.value : [],
    nextGames: nextGamesResult.status === 'fulfilled' ? nextGamesResult.value : [],
    standings: standingsResult.status === 'fulfilled' ? standingsResult.value : [],
    warnings
  });
}
