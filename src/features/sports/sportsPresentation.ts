import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/** Display and odds helpers shared by both MLB and NBA cards; no side effects or storage. */
export type FavoriteSide = 'away' | 'home' | null;
export type SportsPresentationGame = {
  startTime: string;
  status: 'scheduled' | 'live' | 'final';
  statusText: string;
  books: Array<{ provider: string; away: number; home: number }>;
  consensusAway?: number;
  consensusHome?: number;
};

export function odd(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;
}

export function impliedProbability(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 0;
  return value < 0 ? (-value) / ((-value) + 100) : 100 / (value + 100);
}

export function favoriteFromOdds(away?: number, home?: number): FavoriteSide {
  const awayProbability = impliedProbability(away);
  const homeProbability = impliedProbability(home);
  if (!awayProbability || !homeProbability || Math.abs(awayProbability - homeProbability) < 0.0001) return null;
  return awayProbability > homeProbability ? 'away' : 'home';
}

export function favoriteForGame(game: SportsPresentationGame): FavoriteSide {
  if (game.books.length) {
    let awayVotes = 0;
    let homeVotes = 0;
    for (const book of game.books) {
      const favorite = favoriteFromOdds(book.away, book.home);
      if (favorite === 'away') awayVotes += 1;
      if (favorite === 'home') homeVotes += 1;
    }
    if (awayVotes !== homeVotes) return awayVotes > homeVotes ? 'away' : 'home';
  }
  return favoriteFromOdds(game.consensusAway, game.consensusHome);
}

export function shortTeamName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(-1)[0] : name;
}

export function gameClock(game: SportsPresentationGame) {
  if (game.status === 'live') return game.statusText || 'EN VIVO';
  if (game.status === 'final') return game.statusText || 'FINAL';
  const date = new Date(game.startTime);
  if (!Number.isFinite(date.getTime())) return game.statusText || 'Programado';
  return date.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
}

export function dateLabel(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return Number.isFinite(value.getTime())
    ? format(value, "d 'de' MMMM", { locale: es })
    : date;
}

export function marketLabel(game: SportsPresentationGame) {
  if (game.books.length > 1) return 'PROMEDIO';
  if (game.books.length === 1) return game.books[0].provider.toUpperCase();
  return 'MERCADO';
}

