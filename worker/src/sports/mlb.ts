import { json } from '../shared/http';
import { rec, list, str, num, int, nextDate, statusView, marketView, marketConsensus, createTeamView, compareGameStartTime, parseEspnEvent } from './shared/espnCore';

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

function abbr(name: string, supplied?: string) { return supplied?.trim().toUpperCase() || TEAM_ABBR[name] || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase(); }

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return response.json();
}

const teamView = createTeamView(abbr);

function sortGames(games: GameView[]) { return games.sort(compareGameStartTime); }

function parseEspnGames(payload: unknown): GameView[] {
  const root = rec(payload);
  const games = list(root.events).map((raw) => parseEspnEvent(raw, teamView)).filter(Boolean) as GameView[];
  return sortGames(games);
}

function officialStatus(value: unknown) {
  const status = rec(value);
  const abstract = str(status.abstractGameState).toLowerCase();
  const detailed = str(status.detailedState) || str(status.abstractGameState) || 'PROGRAMADO';
  if (abstract === 'live') return { status: 'live' as const, statusText: detailed };
  if (abstract === 'final') return { status: 'final' as const, statusText: detailed };
  return { status: 'scheduled' as const, statusText: detailed };
}

function officialTeam(slot: AnyRecord): TeamView {
  const team = rec(slot.team);
  const name = str(team.name) || str(team.teamName) || 'Equipo';
  const teamId = int(team.id);
  const score = num(slot.score);
  return {
    name,
    abbreviation: abbr(name, str(team.abbreviation)),
    logo: teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : undefined,
    score: score === undefined ? undefined : String(score)
  };
}

async function loadOfficialGames(date: string): Promise<GameView[]> {
  const payload = rec(await getJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,venue,linescore`));
  const games: GameView[] = [];
  for (const rawDate of list(payload.dates)) {
    const dateRecord = rec(rawDate);
    for (const rawGame of list(dateRecord.games)) {
      const game = rec(rawGame);
      const teams = rec(game.teams);
      const awaySlot = rec(teams.away);
      const homeSlot = rec(teams.home);
      const status = officialStatus(game.status);
      const venue = rec(game.venue);
      games.push({
        id: String(int(game.gamePk) || crypto.randomUUID()),
        startTime: str(game.gameDate),
        status: status.status,
        statusText: status.statusText,
        venue: str(venue.name) || undefined,
        away: officialTeam(awaySlot),
        home: officialTeam(homeSlot),
        books: []
      });
    }
  }
  return sortGames(games);
}

async function loadEspnGames(date: string, seasonType?: 2 | 3) {
  const compact = date.replaceAll('-', '');
  const seasonParam = seasonType ? `&seasontype=${seasonType}` : '';
  const payload = await getJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${compact}&limit=100${seasonParam}`);
  return parseEspnGames(payload);
}

async function loadGames(date: string): Promise<GameView[]> {
  // ESPN's default scoreboard can return an empty slate during postseason.
  // Try the normal feed first, then explicitly postseason, then MLB's official schedule.
  try {
    const normal = await loadEspnGames(date);
    if (normal.length) return normal;
  } catch {
    // Continue to postseason/offical fallbacks.
  }

  try {
    const postseason = await loadEspnGames(date, 3);
    if (postseason.length) return postseason;
  } catch {
    // Continue to official MLB schedule.
  }

  return loadOfficialGames(date);
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
