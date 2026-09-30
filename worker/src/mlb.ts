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
  league: 'AL' | 'NL';
  division: string;
  team: string;
  abbreviation: string;
  wins: number;
  losses: number;
  pct: string;
  gamesBack: string;
  rank: number;
};

const TEAM_ABBR: Record<string, string> = {
  'Arizona Diamondbacks': 'ARI', 'Athletics': 'ATH', 'Oakland Athletics': 'OAK', 'Atlanta Braves': 'ATL',
  'Baltimore Orioles': 'BAL', 'Boston Red Sox': 'BOS', 'Chicago Cubs': 'CHC', 'Chicago White Sox': 'CWS',
  'Cincinnati Reds': 'CIN', 'Cleveland Guardians': 'CLE', 'Colorado Rockies': 'COL', 'Detroit Tigers': 'DET',
  'Houston Astros': 'HOU', 'Kansas City Royals': 'KC', 'Los Angeles Angels': 'LAA', 'Los Angeles Dodgers': 'LAD',
  'Miami Marlins': 'MIA', 'Milwaukee Brewers': 'MIL', 'Minnesota Twins': 'MIN', 'New York Mets': 'NYM',
  'New York Yankees': 'NYY', 'Philadelphia Phillies': 'PHI', 'Pittsburgh Pirates': 'PIT', 'San Diego Padres': 'SD',
  'San Francisco Giants': 'SF', 'Seattle Mariners': 'SEA', 'St. Louis Cardinals': 'STL', 'Tampa Bay Rays': 'TB',
  'Texas Rangers': 'TEX', 'Toronto Blue Jays': 'TOR', 'Washington Nationals': 'WSH'
};

const DIVISION_META: Record<number, { league: 'AL' | 'NL'; name: string }> = {
  200: { league: 'AL', name: 'Oeste' },
  201: { league: 'AL', name: 'Este' },
  202: { league: 'AL', name: 'Central' },
  203: { league: 'NL', name: 'Oeste' },
  204: { league: 'NL', name: 'Este' },
  205: { league: 'NL', name: 'Central' }
};

function rec(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}
function int(value: unknown, fallback = 0) { const parsed = num(value); return parsed === undefined ? fallback : Math.trunc(parsed); }
function abbr(name: string, supplied?: string) { return supplied?.trim().toUpperCase() || TEAM_ABBR[name] || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase(); }

function nextDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return response.json();
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
  return { name, abbreviation: abbr(name, str(team.abbreviation)), logo: str(team.logo) || undefined, score: str(value.score) || undefined };
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

function marketConsensus(books: BookView[]) {
  if (!books.length) return {};
  if (books.length === 1) return { away: books[0].away, home: books[0].home };

  const awayProbability = books.reduce((sum, book) => sum + impliedProbability(book.away), 0) / books.length;
  const homeProbability = books.reduce((sum, book) => sum + impliedProbability(book.home), 0) / books.length;
  return {
    away: americanFromProbability(awayProbability),
    home: americanFromProbability(homeProbability)
  };
}

async function loadGames(date: string): Promise<GameView[]> {
  const compact = date.replaceAll('-', '');
  const payload = rec(await getJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${compact}&limit=100`));
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

  return games.sort((a, b) => {
    const aTime = new Date(a.startTime).getTime();
    const bTime = new Date(b.startTime).getTime();
    return (Number.isFinite(aTime) ? aTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bTime) ? bTime : Number.MAX_SAFE_INTEGER);
  });
}

function divisionName(value: string) {
  const trimmed = value.replace(/^American League\s+/i, '').replace(/^National League\s+/i, '').replace(/^AL\s+/i, '').replace(/^NL\s+/i, '');
  if (/east/i.test(trimmed)) return 'Este';
  if (/central/i.test(trimmed)) return 'Central';
  if (/west/i.test(trimmed)) return 'Oeste';
  return trimmed || 'División';
}

async function standingsForSeason(season: number): Promise<StandingView[]> {
  const payload = rec(await getJson(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`));
  const rows: StandingView[] = [];
  for (const rawRecord of list(payload.records)) {
    const standing = rec(rawRecord);
    const division = rec(standing.division);
    const leagueInfo = rec(standing.league);
    const divisionId = int(division.id);
    const divisionFull = str(division.name);
    const mapped = DIVISION_META[divisionId];
    const league: 'AL' | 'NL' = mapped?.league || (/american/i.test(divisionFull) || int(leagueInfo.id) === 103 ? 'AL' : 'NL');
    const divisionLabel = mapped?.name || divisionName(divisionFull);
    for (const rawTeam of list(standing.teamRecords)) {
      const teamRecord = rec(rawTeam);
      const team = rec(teamRecord.team);
      const name = str(team.name) || 'Equipo';
      rows.push({
        league,
        division: divisionLabel,
        team: name,
        abbreviation: abbr(name, str(team.abbreviation)),
        wins: int(teamRecord.wins),
        losses: int(teamRecord.losses),
        pct: str(teamRecord.winningPercentage) || '.000',
        gamesBack: str(teamRecord.gamesBack) || '-',
        rank: int(teamRecord.divisionRank, 1)
      });
    }
  }
  return rows;
}

async function loadStandings(date: string) {
  const year = int(date.slice(0, 4), new Date().getUTCFullYear());
  const current = await standingsForSeason(year);
  return current.length ? current : standingsForSeason(year - 1);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function handleMlbRequest(request: Request): Promise<Response> {
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

  if (gamesResult.status === 'rejected' && nextGamesResult.status === 'rejected' && standingsResult.status === 'rejected') {
    return json({ error: 'mlb_upstream_unavailable' }, 502);
  }

  const warnings: string[] = [];
  if (gamesResult.status === 'rejected') warnings.push('games_unavailable');
  if (nextGamesResult.status === 'rejected') warnings.push('next_games_unavailable');
  if (standingsResult.status === 'rejected') warnings.push('standings_unavailable');

  return json({
    date,
    nextDate: next,
    updatedAt: new Date().toISOString(),
    games: gamesResult.status === 'fulfilled' ? gamesResult.value : [],
    nextGames: nextGamesResult.status === 'fulfilled' ? nextGamesResult.value : [],
    standings: standingsResult.status === 'fulfilled' ? standingsResult.value : [],
    warnings
  });
}
