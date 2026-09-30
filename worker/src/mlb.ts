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

function rec(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}
function int(value: unknown, fallback = 0) { const parsed = num(value); return parsed === undefined ? fallback : Math.trunc(parsed); }
function abbr(name: string, supplied?: string) { return supplied?.trim().toUpperCase() || TEAM_ABBR[name] || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase(); }

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

function marketView(competition: AnyRecord): BookView[] {
  const rows: BookView[] = [];
  for (const raw of list(competition.odds)) {
    const item = rec(raw);
    const away = num(rec(item.awayTeamOdds).moneyLine);
    const home = num(rec(item.homeTeamOdds).moneyLine);
    if (away === undefined || home === undefined || away === 0 || home === 0) continue;
    const provider = rec(item.provider);
    rows.push({ provider: str(provider.name) || str(provider.displayName) || 'Mercado', away, home });
  }
  return rows.slice(0, 3);
}

async function loadGames(date: string): Promise<GameView[]> {
  const compact = date.replaceAll('-', '');
  const payload = rec(await getJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${compact}&limit=100`));
  return list(payload.events).map((raw) => {
    const event = rec(raw);
    const competition = rec(list(event.competitions)[0]);
    const competitors = list(competition.competitors).map(rec);
    const awayRaw = competitors.find((item) => str(item.homeAway) === 'away');
    const homeRaw = competitors.find((item) => str(item.homeAway) === 'home');
    if (!awayRaw || !homeRaw) return null;
    const books = marketView(competition);
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
      consensusAway: books[0]?.away,
      consensusHome: books[0]?.home,
      books
    } satisfies GameView;
  }).filter(Boolean) as GameView[];
}

function divisionName(value: string) {
  return value.replace(/^American League\s+/i, '').replace(/^National League\s+/i, '').replace(/^AL\s+/i, '').replace(/^NL\s+/i, '') || 'División';
}

async function standingsForSeason(season: number): Promise<StandingView[]> {
  const payload = rec(await getJson(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`));
  const rows: StandingView[] = [];
  for (const rawRecord of list(payload.records)) {
    const standing = rec(rawRecord);
    const division = rec(standing.division);
    const leagueInfo = rec(standing.league);
    const divisionFull = str(division.name);
    const league: 'AL' | 'NL' = /american/i.test(divisionFull) || int(leagueInfo.id) === 103 ? 'AL' : 'NL';
    for (const rawTeam of list(standing.teamRecords)) {
      const teamRecord = rec(rawTeam);
      const team = rec(teamRecord.team);
      const name = str(team.name) || 'Equipo';
      rows.push({
        league,
        division: divisionName(divisionFull),
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

  const [gamesResult, standingsResult] = await Promise.allSettled([loadGames(date), loadStandings(date)]);
  if (gamesResult.status === 'rejected' && standingsResult.status === 'rejected') return json({ error: 'mlb_upstream_unavailable' }, 502);
  const warnings: string[] = [];
  if (gamesResult.status === 'rejected') warnings.push('games_unavailable');
  if (standingsResult.status === 'rejected') warnings.push('standings_unavailable');

  return json({
    date,
    updatedAt: new Date().toISOString(),
    games: gamesResult.status === 'fulfilled' ? gamesResult.value : [],
    standings: standingsResult.status === 'fulfilled' ? standingsResult.value : [],
    warnings
  });
}
