type AnyRecord = Record<string, unknown>;

type Sport = 'MLB' | 'NBA';
type FormGame = { date: string; result: 'W' | 'L'; opponent: string; score?: string };
type FormView = {
  last5: { wins: number; losses: number; sequence: string[] };
  last10: { wins: number; losses: number; sequence: string[] };
  games: FormGame[];
  sourceSeason?: number;
};
type InjuryView = { name: string; status: string; detail?: string };

type ContextResponse = {
  updatedAt: string;
  form: { away: FormView | null; home: FormView | null };
  probablePitchers?: { away?: string; home?: string };
  lineups: { away: string[]; home: string[]; status: 'published' | 'unavailable' };
  injuries: { away: InjuryView[]; home: InjuryView[] };
  warnings: string[];
};

function rec(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}
function bool(value: unknown) { return value === true || value === 'true'; }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function dateOnly(value: string) { return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''; }

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'DJ-NOA/1.0' } });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return response.json();
}

function seasonFor(sport: Sport, date: string) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (sport === 'MLB') return year;
  return month >= 9 ? year + 1 : year;
}

function sportPath(sport: Sport) {
  return sport === 'MLB' ? 'baseball/mlb' : 'basketball/nba';
}

function teamNameFromCompetitor(value: AnyRecord) {
  const team = rec(value.team);
  return str(team.displayName) || str(team.shortDisplayName) || str(team.name) || str(team.abbreviation) || 'Rival';
}

function teamAbbrFromCompetitor(value: AnyRecord) {
  const team = rec(value.team);
  return (str(team.abbreviation) || str(team.shortDisplayName)).toUpperCase();
}

function scoreText(competition: AnyRecord, mine: AnyRecord, opponent: AnyRecord) {
  const mineScore = str(mine.score);
  const opponentScore = str(opponent.score);
  if (mineScore && opponentScore) return `${mineScore}-${opponentScore}`;
  const detail = str(rec(competition.status).type && rec(rec(competition.status).type).shortDetail);
  return detail || undefined;
}

function parseScheduleForm(payload: unknown, abbreviation: string, targetDate: string, sourceSeason: number): FormView | null {
  const games: FormGame[] = [];
  const targetTime = new Date(`${targetDate}T23:59:59Z`).getTime();
  for (const rawEvent of list(rec(payload).events)) {
    const event = rec(rawEvent);
    const eventDate = str(event.date);
    const eventTime = new Date(eventDate).getTime();
    if (Number.isFinite(targetTime) && Number.isFinite(eventTime) && eventTime > targetTime) continue;
    const competition = rec(list(event.competitions)[0]);
    const status = rec(event.status);
    const statusType = rec(status.type);
    const state = str(statusType.state).toLowerCase();
    if (state !== 'post' && !bool(statusType.completed)) continue;
    const competitors = list(competition.competitors).map(rec);
    const mine = competitors.find((item) => teamAbbrFromCompetitor(item) === abbreviation.toUpperCase());
    if (!mine) continue;
    const opponent = competitors.find((item) => item !== mine);
    if (!opponent) continue;
    let won: boolean | undefined;
    if (typeof mine.winner === 'boolean') won = mine.winner;
    if (won === undefined) {
      const myScore = num(mine.score);
      const theirScore = num(opponent.score);
      if (myScore !== undefined && theirScore !== undefined && myScore !== theirScore) won = myScore > theirScore;
    }
    if (won === undefined) continue;
    games.push({
      date: dateOnly(eventDate) || eventDate,
      result: won ? 'W' : 'L',
      opponent: teamNameFromCompetitor(opponent),
      score: scoreText(competition, mine, opponent)
    });
  }
  games.sort((a, b) => b.date.localeCompare(a.date));
  const recent = games.slice(0, 10);
  if (!recent.length) return null;
  const aggregate = (items: FormGame[]) => ({
    wins: items.filter((game) => game.result === 'W').length,
    losses: items.filter((game) => game.result === 'L').length,
    sequence: items.map((game) => game.result)
  });
  return {
    last5: aggregate(recent.slice(0, 5)),
    last10: aggregate(recent),
    games: recent,
    sourceSeason
  };
}

async function loadRecentForm(sport: Sport, abbreviation: string, targetDate: string): Promise<FormView | null> {
  const currentSeason = seasonFor(sport, targetDate);
  const path = sportPath(sport);
  const team = encodeURIComponent(abbreviation.toLowerCase());
  for (const season of [currentSeason, currentSeason - 1]) {
    try {
      const payload = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${team}/schedule?season=${season}`);
      const parsed = parseScheduleForm(payload, abbreviation, targetDate, season);
      if (parsed && parsed.games.length >= 1) return parsed;
    } catch {
      // Try the previous season as a stable fallback.
    }
  }
  return null;
}

function injuryName(item: AnyRecord) {
  const athlete = rec(item.athlete);
  const player = rec(item.player);
  const person = rec(item.person);
  return str(athlete.displayName) || str(athlete.fullName) || str(player.displayName) || str(player.fullName) || str(person.fullName) || str(item.displayName) || str(item.name);
}

function injuryStatus(item: AnyRecord) {
  const status = rec(item.status);
  const type = rec(item.type);
  return str(status.name) || str(status.description) || str(type.description) || str(type.name) || str(item.status) || str(item.type) || 'Reportado';
}

function injuryDetail(item: AnyRecord) {
  const details = rec(item.details);
  return str(item.description) || str(item.detail) || str(details.detail) || str(details.description) || str(item.longComment) || undefined;
}

function collectInjuries(value: unknown, output: InjuryView[], seen: Set<string>, depth = 0) {
  if (depth > 6 || output.length >= 8) return;
  if (Array.isArray(value)) {
    for (const item of value) collectInjuries(item, output, seen, depth + 1);
    return;
  }
  const item = rec(value);
  if (!Object.keys(item).length) return;
  const name = injuryName(item);
  const hasSignal = 'status' in item || 'type' in item || 'injury' in item || 'details' in item;
  if (name && hasSignal) {
    const key = normalize(name);
    if (key && !seen.has(key)) {
      seen.add(key);
      output.push({ name, status: injuryStatus(item), detail: injuryDetail(item) });
    }
  }
  for (const child of Object.values(item)) {
    if (typeof child === 'object' && child !== null) collectInjuries(child, output, seen, depth + 1);
    if (output.length >= 8) break;
  }
}

async function loadTeamInjuries(sport: Sport, abbreviation: string): Promise<InjuryView[]> {
  const path = sportPath(sport);
  const team = encodeURIComponent(abbreviation.toLowerCase());
  const candidates = [
    `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${team}/injuries`,
    `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${team}`
  ];
  for (const url of candidates) {
    try {
      const payload = await getJson(url);
      const output: InjuryView[] = [];
      collectInjuries(payload, output, new Set());
      if (output.length) return output.slice(0, 8);
    } catch {
      // Try another public source.
    }
  }
  return [];
}

function matchTeam(team: AnyRecord, queryName: string, queryAbbr: string) {
  const name = str(team.name) || str(team.teamName);
  const abbreviation = str(team.abbreviation) || str(team.abbrev);
  const qName = normalize(queryName);
  const qAbbr = normalize(queryAbbr);
  return Boolean((qAbbr && normalize(abbreviation) === qAbbr) || (qName && (normalize(name) === qName || normalize(name).includes(qName) || qName.includes(normalize(name)))));
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
    const awayTeam = rec(rec(teams.away).team);
    const homeTeam = rec(rec(teams.home).team);
    return matchTeam(awayTeam, awayName, awayAbbr) && matchTeam(homeTeam, homeName, homeAbbr);
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
    lineups: {
      away: awayLineup,
      home: homeLineup,
      status: awayLineup.length || homeLineup.length ? 'published' as const : 'unavailable' as const
    }
  };
}

function collectStarters(value: unknown, output: string[], seen: Set<string>, depth = 0) {
  if (depth > 7 || output.length >= 10) return;
  if (Array.isArray(value)) {
    for (const item of value) collectStarters(item, output, seen, depth + 1);
    return;
  }
  const item = rec(value);
  if (!Object.keys(item).length) return;
  if (item.starter === true) {
    const athlete = rec(item.athlete);
    const name = str(athlete.displayName) || str(athlete.fullName) || str(item.displayName) || str(item.name);
    const key = normalize(name);
    if (name && key && !seen.has(key)) { seen.add(key); output.push(name); }
  }
  for (const child of Object.values(item)) {
    if (typeof child === 'object' && child !== null) collectStarters(child, output, seen, depth + 1);
  }
}

async function loadNbaGameLineups(gameId: string) {
  if (!/^\d{6,}$/.test(gameId)) return { away: [], home: [], status: 'unavailable' as const };
  try {
    const payload = rec(await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(gameId)}`));
    const groups = list(rec(payload.boxscore).players).map(rec);
    const lineups: string[][] = [];
    for (const group of groups.slice(0, 2)) {
      const names: string[] = [];
      collectStarters(group, names, new Set());
      lineups.push(names.slice(0, 5));
    }
    const away = lineups[0] || [];
    const home = lineups[1] || [];
    return { away, home, status: away.length || home.length ? 'published' as const : 'unavailable' as const };
  } catch {
    return { away: [], home: [], status: 'unavailable' as const };
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function handleSportsContext(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(request.url);
  const sport = str(url.searchParams.get('sport')).toUpperCase() as Sport;
  const gameId = str(url.searchParams.get('gameId'));
  const date = dateOnly(str(url.searchParams.get('date')));
  const away = str(url.searchParams.get('away')).toUpperCase();
  const home = str(url.searchParams.get('home')).toUpperCase();
  const awayName = str(url.searchParams.get('awayName'));
  const homeName = str(url.searchParams.get('homeName'));
  if (!['MLB', 'NBA'].includes(sport) || !date || !away || !home) return json({ error: 'invalid_request' }, 400);

  const warnings: string[] = [];
  const [awayFormResult, homeFormResult, awayInjuriesResult, homeInjuriesResult] = await Promise.allSettled([
    loadRecentForm(sport, away, date),
    loadRecentForm(sport, home, date),
    loadTeamInjuries(sport, away),
    loadTeamInjuries(sport, home)
  ]);

  if (awayFormResult.status === 'rejected') warnings.push('away_form_unavailable');
  if (homeFormResult.status === 'rejected') warnings.push('home_form_unavailable');
  if (awayInjuriesResult.status === 'rejected') warnings.push('away_injuries_unavailable');
  if (homeInjuriesResult.status === 'rejected') warnings.push('home_injuries_unavailable');

  let probablePitchers: { away?: string; home?: string } | undefined;
  let lineups: ContextResponse['lineups'] = { away: [], home: [], status: 'unavailable' };
  if (sport === 'MLB') {
    try {
      const mlb = await loadMlbGameContext(date, awayName, away, homeName, home);
      probablePitchers = mlb.probablePitchers;
      lineups = mlb.lineups;
    } catch {
      warnings.push('mlb_game_context_unavailable');
    }
  } else {
    lineups = await loadNbaGameLineups(gameId);
  }

  const response: ContextResponse = {
    updatedAt: new Date().toISOString(),
    form: {
      away: awayFormResult.status === 'fulfilled' ? awayFormResult.value : null,
      home: homeFormResult.status === 'fulfilled' ? homeFormResult.value : null
    },
    probablePitchers,
    lineups,
    injuries: {
      away: awayInjuriesResult.status === 'fulfilled' ? awayInjuriesResult.value : [],
      home: homeInjuriesResult.status === 'fulfilled' ? homeInjuriesResult.value : []
    },
    warnings
  };
  return json(response);
}
