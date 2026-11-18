/** Canonical ESPN-compatible parsers for MLB and NBA. Inputs/outputs frozen by regression tests.
 * Deliberately excludes league-specific team abbreviations, official feeds and network headers. */
export type AnyRecord = Record<string, unknown>;
export type BookView = { provider: string; away: number; home: number };

export function rec(value: unknown): AnyRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {}; }
export function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
export function str(value: unknown) { return typeof value === 'string' ? value : ''; }
export function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}
export function int(value: unknown, fallback = 0) { const parsed = num(value); return parsed === undefined ? fallback : Math.trunc(parsed); }
export function nextDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function statusView(value: unknown) {
  const status = rec(value);
  const type = rec(status.type);
  const state = str(type.state).toLowerCase();
  const detail = str(type.shortDetail) || str(type.detail) || str(status.displayClock);
  if (state === 'in') return { status: 'live' as const, statusText: detail || 'EN VIVO' };
  if (state === 'post') return { status: 'final' as const, statusText: detail || 'FINAL' };
  return { status: 'scheduled' as const, statusText: detail || 'PROGRAMADO' };
}

export function marketMoneyLine(item: AnyRecord, side: 'away' | 'home') {
  const teamOdds = rec(side === 'away' ? item.awayTeamOdds : item.homeTeamOdds);
  return num(teamOdds.moneyLine)
    ?? num(teamOdds.moneyline)
    ?? num(item[`${side}MoneyLine`])
    ?? num(item[`${side}Moneyline`]);
}

export function marketView(competition: AnyRecord): BookView[] {
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

export function impliedProbability(american: number) {
  return american < 0 ? (-american) / ((-american) + 100) : 100 / (american + 100);
}

export function americanFromProbability(probability: number) {
  if (!(probability > 0 && probability < 1)) return undefined;
  const american = probability >= 0.5
    ? -(100 * probability) / (1 - probability)
    : (100 * (1 - probability)) / probability;
  return Math.round(american);
}

export function marketConsensus(books: BookView[]) {
  if (!books.length) return {};
  if (books.length === 1) return { away: books[0].away, home: books[0].home };

  const awayProbability = books.reduce((sum, book) => sum + impliedProbability(book.away), 0) / books.length;
  const homeProbability = books.reduce((sum, book) => sum + impliedProbability(book.home), 0) / books.length;
  return {
    away: americanFromProbability(awayProbability),
    home: americanFromProbability(homeProbability)
  };
}


/** ESPN team view with the league-specific abbreviation resolver injected exactly once. */
export function createTeamView(abbr: (name: string, supplied?: string) => string) {
  return (value: AnyRecord) => {
    const team = rec(value.team);
    const name = str(team.displayName) || str(team.name) || str(team.shortDisplayName) || 'Equipo';
    return { name, abbreviation: abbr(name, str(team.abbreviation)), logo: str(team.logo) || undefined, score: str(value.score) || undefined };
  };
}

/** Match the original ESPN game ordering while preserving the caller's mutation policy. */
export function compareGameStartTime(a: {startTime: string}, b: {startTime: string}): number {
  const aTime = new Date(a.startTime).getTime();
  const bTime = new Date(b.startTime).getTime();
  return (Number.isFinite(aTime) ? aTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bTime) ? bTime : Number.MAX_SAFE_INTEGER);
}
