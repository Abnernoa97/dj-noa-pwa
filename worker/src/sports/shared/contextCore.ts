import { rec, list, str, type AnyRecord } from './espnCore.ts';

/** Sports context and live share identical text normalization and lexical ISO-day extraction. */
export function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function dateOnly(value: string) { return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''; }


/** Original MLB batting order semantics; names in published order, maximum nine. */
export function playerName(value: unknown) {
  const item = rec(value);
  return str(item.fullName) || str(item.displayName) || str(item.name);
}

export function lineupFromBoxscoreSide(side: AnyRecord) {
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


/** Common W/L aggregation used by historical context and live views. */
export function aggregateForm(items: readonly {result: 'W' | 'L'}[]) {
  return {
    wins: items.filter((game) => game.result === 'W').length,
    losses: items.filter((game) => game.result === 'L').length,
    sequence: items.map((game) => game.result)
  };
}

/** One MLB schedule+boxscore pipeline; each caller retains its own fetch and team-match policy. */
export function createMlbGameContextLoader(
  getJson: (url: string) => Promise<unknown>,
  matchTeam: (team: AnyRecord, queryName: string, queryAbbr: string) => boolean
) {
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
  return loadMlbGameContext;
}
