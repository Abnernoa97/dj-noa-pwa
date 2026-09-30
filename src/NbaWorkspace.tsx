import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type NbaBookOdds = { provider: string; away: number; home: number };
type NbaGame = {
  id: string;
  startTime: string;
  status: 'scheduled' | 'live' | 'final';
  statusText: string;
  venue?: string;
  away: { name: string; abbreviation: string; logo?: string; score?: string };
  home: { name: string; abbreviation: string; logo?: string; score?: string };
  consensusAway?: number;
  consensusHome?: number;
  books: NbaBookOdds[];
};
type NbaStanding = {
  conference: 'EAST' | 'WEST';
  team: string;
  abbreviation: string;
  wins: number;
  losses: number;
  pct: string;
  gamesBack: string;
  rank: number;
};
type NbaSnapshot = {
  date: string;
  nextDate?: string;
  updatedAt: string;
  season?: number;
  standingsSeason?: number;
  games: NbaGame[];
  nextGames?: NbaGame[];
  standings: NbaStanding[];
  warnings?: string[];
};
type Props = { onBack: () => void };
type FavoriteSide = 'away' | 'home' | null;

const CACHE_KEY = 'dj-noa-nba-snapshot-v2';

function readCachedSnapshot(): NbaSnapshot | null {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) as NbaSnapshot : null; } catch { return null; }
}
function writeCachedSnapshot(snapshot: NbaSnapshot) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot)); } catch { /* best effort */ } }
function odd(value?: number) { if (typeof value !== 'number' || !Number.isFinite(value)) return '—'; return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`; }
function impliedProbability(value?: number) { if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 0; return value < 0 ? (-value) / ((-value) + 100) : 100 / (value + 100); }
function favoriteFromOdds(away?: number, home?: number): FavoriteSide {
  const a = impliedProbability(away); const h = impliedProbability(home);
  if (!a || !h || Math.abs(a - h) < 0.0001) return null;
  return a > h ? 'away' : 'home';
}
function favoriteForGame(game: NbaGame): FavoriteSide {
  if (game.books.length) {
    let awayVotes = 0; let homeVotes = 0;
    for (const book of game.books) { const favorite = favoriteFromOdds(book.away, book.home); if (favorite === 'away') awayVotes += 1; if (favorite === 'home') homeVotes += 1; }
    if (awayVotes !== homeVotes) return awayVotes > homeVotes ? 'away' : 'home';
  }
  return favoriteFromOdds(game.consensusAway, game.consensusHome);
}
function shortTeamName(name: string) { const parts = name.trim().split(/\s+/); return parts.length > 1 ? parts.slice(-1)[0] : name; }
function gameClock(game: NbaGame) {
  if (game.status === 'live') return game.statusText || 'EN VIVO';
  if (game.status === 'final') return game.statusText || 'FINAL';
  const date = new Date(game.startTime);
  if (!Number.isFinite(date.getTime())) return game.statusText || 'Programado';
  return date.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
}
function dateLabel(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return Number.isFinite(value.getTime()) ? format(value, "d 'de' MMMM", { locale: es }) : date;
}
function marketLabel(game: NbaGame) {
  if (game.books.length > 1) return 'PROMEDIO';
  if (game.books.length === 1) return game.books[0].provider.toUpperCase();
  return 'MERCADO';
}
function seasonLabel(season?: number) {
  if (!season) return 'NBA';
  const start = season - 1;
  return `${start}-${String(season).slice(-2)}`;
}
function datePlusDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function lastSeasonReference(date: string) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const endYear = month >= 7 ? year : year - 1;
  return `${endYear}-06-15`;
}
function futureGames(games?: NbaGame[]) {
  return (games || []).filter((game) => game.status !== 'final');
}
async function fetchNbaSnapshot(date: string): Promise<NbaSnapshot> {
  const response = await fetch(`/api/nba?date=${date}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`nba_${response.status}`);
  return response.json() as Promise<NbaSnapshot>;
}

export default function NbaWorkspace({ onBack }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [snapshot, setSnapshot] = useState<NbaSnapshot | null>(() => {
    const cached = readCachedSnapshot();
    return cached?.date === today ? cached : null;
  });
  const [conference, setConference] = useState<'EAST' | 'WEST'>('EAST');
  const [loading, setLoading] = useState(!snapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    try {
      let data = await fetchNbaSnapshot(today);

      if (!data.standings?.length) {
        try {
          const previous = await fetchNbaSnapshot(lastSeasonReference(today));
          if (previous.standings?.length) {
            data = { ...data, standings: previous.standings, standingsSeason: previous.season };
          }
        } catch {
          // Keep the primary response if historical standings are temporarily unavailable.
        }
      } else {
        data = { ...data, standingsSeason: data.season };
      }

      const hasTodayOrTomorrow = futureGames(data.games).length > 0 || futureGames(data.nextGames).length > 0;
      if (!hasTodayOrTomorrow) {
        for (let offset = 2; offset <= 14; offset += 2) {
          try {
            const candidate = await fetchNbaSnapshot(datePlusDays(today, offset));
            const sameDay = futureGames(candidate.games);
            const followingDay = futureGames(candidate.nextGames);
            if (sameDay.length) {
              data = { ...data, nextDate: candidate.date, nextGames: sameDay };
              break;
            }
            if (followingDay.length) {
              data = { ...data, nextDate: candidate.nextDate || datePlusDays(candidate.date, 1), nextGames: followingDay };
              break;
            }
          } catch {
            // Keep searching later dates.
          }
        }
      }

      setSnapshot(data); writeCachedSnapshot(data); setError('');
    } catch {
      const cached = readCachedSnapshot();
      if (cached?.date === today) setSnapshot(cached);
      setError(cached?.date === today ? 'Mostrando la última actualización guardada.' : 'No pude actualizar NBA en este momento.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [today]);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(false), 3 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  const activeRows = useMemo(() => (snapshot?.standings || []).filter((row) => row.conference === conference).sort((a, b) => a.rank - b.rank), [snapshot, conference]);
  const todayGames = useMemo(() => futureGames(snapshot?.games).sort((a, b) => {
    if (a.status !== b.status) { if (a.status === 'live') return -1; if (b.status === 'live') return 1; }
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  }), [snapshot]);
  const nextGames = useMemo(() => futureGames(snapshot?.nextGames), [snapshot]);
  const showingToday = todayGames.length > 0;
  const displayedGames = showingToday ? todayGames : nextGames;
  const gamesDate = showingToday ? today : (snapshot?.nextDate || today);
  const hasLive = displayedGames.some((game) => game.status === 'live');
  const standingsArePrevious = Boolean(snapshot?.standingsSeason && snapshot?.season && snapshot.standingsSeason !== snapshot.season);

  return (
    <section className="mlb-workspace nba-workspace">
      <header className="mlb-page-head">
        <button className="mlb-back" onClick={onBack} aria-label="Volver a Inicio"><ArrowLeft size={26} /></button>
        <div className="mlb-brand-lockup nba-brand-lockup">
          <img src="https://cdn.nba.com/logos/leagues/logo-nba.svg" alt="NBA" />
          <div><span>DAILY BOARD</span><strong>{dateLabel(today)}</strong></div>
        </div>
        <button className={`mlb-refresh ${refreshing ? 'spinning' : ''}`} onClick={() => void load(true)} disabled={refreshing} aria-label="Actualizar NBA"><RefreshCw size={24} /></button>
      </header>

      <div className="mlb-page-scroll">
        <section className="mlb-standings-panel nba-standings-panel">
          <div className="mlb-section-head">
            <div><span>NBA {seasonLabel(snapshot?.standingsSeason || snapshot?.season)}{standingsArePrevious ? ' · ÚLTIMA TABLA' : ''}</span><h2>Tabla de posiciones</h2></div>
            <Trophy size={28} />
          </div>

          <div className="mlb-league-tabs" role="tablist" aria-label="Conferencia">
            <button className={conference === 'EAST' ? 'active' : ''} onClick={() => setConference('EAST')}>ESTE</button>
            <button className={conference === 'WEST' ? 'active' : ''} onClick={() => setConference('WEST')}>OESTE</button>
          </div>

          {loading && !snapshot ? <div className="mlb-loading">Actualizando tabla de posiciones…</div> : null}
          {!loading && !activeRows.length ? <div className="mlb-empty-line">Posiciones no disponibles por ahora.</div> : null}

          {activeRows.length ? <div className="mlb-division active">
            <div className="mlb-division-title">Conferencia {conference === 'EAST' ? 'Este' : 'Oeste'}</div>
            <div className="mlb-standings-grid mlb-standings-labels"><span>EQUIPO</span><span>G</span><span>P</span><span>PCT</span><span>DIF</span></div>
            {activeRows.map((row) => (
              <div className="mlb-standings-grid" key={`${conference}-${row.abbreviation}`}>
                <span className="mlb-team-cell"><b>{row.rank}</b><strong>{row.abbreviation}</strong><small>{shortTeamName(row.team)}</small></span>
                <span>{row.wins}</span><span>{row.losses}</span><span>{row.pct}</span><span>{row.gamesBack === '-' ? '—' : row.gamesBack}</span>
              </div>
            ))}
          </div> : null}
        </section>

        <section className={`mlb-games-section ${showingToday ? 'is-today' : 'is-next'} ${hasLive ? 'has-live' : ''}`}>
          <div className="mlb-games-title">
            <div>
              <span>{showingToday ? `HOY · ${dateLabel(gamesDate).toUpperCase()}${hasLive ? ' · EN VIVO' : ''}` : `PRÓXIMOS · ${dateLabel(gamesDate).toUpperCase()}`}</span>
              <h2>Enfrentamientos y momios</h2>
            </div>
            <small>{displayedGames.length} {displayedGames.length === 1 ? 'juego' : 'juegos'}</small>
          </div>

          {error ? <div className="mlb-data-note">{error}</div> : null}
          {loading && !snapshot ? <div className="mlb-loading games">Buscando juegos y momios…</div> : null}
          {!loading && snapshot && !displayedGames.length ? <div className="mlb-no-games">No encontré próximos juegos programados en los siguientes días.</div> : null}

          <div className="mlb-games-list">
            {displayedGames.map((game, index) => {
              const favorite = favoriteForGame(game);
              return (
                <article className={`mlb-game-card ${index % 2 ? 'red-edge' : 'blue-edge'} ${game.status === 'live' ? 'is-live-card' : ''}`} key={game.id}>
                  <div className="mlb-game-meta"><span className={`mlb-status ${game.status}`}>{gameClock(game)}</span><small>{game.venue || 'NBA'}</small></div>
                  <div className="mlb-matchup">
                    <div className={`mlb-club away ${favorite === 'away' ? 'market-favorite' : ''}`}>
                      {game.away.logo ? <img src={game.away.logo} alt="" /> : <span className="mlb-logo-fallback">{game.away.abbreviation.slice(0, 1)}</span>}
                      <strong>{game.away.abbreviation}</strong><small>{shortTeamName(game.away.name)}</small>{favorite === 'away' ? <em>FAVORITO</em> : null}
                    </div>
                    <div className="mlb-versus"><span>VS</span>{game.status !== 'scheduled' && (game.away.score || game.home.score) ? <b>{game.away.score || '0'} · {game.home.score || '0'}</b> : null}</div>
                    <div className={`mlb-club home ${favorite === 'home' ? 'market-favorite' : ''}`}>
                      {game.home.logo ? <img src={game.home.logo} alt="" /> : <span className="mlb-logo-fallback">{game.home.abbreviation.slice(0, 1)}</span>}
                      <strong>{game.home.abbreviation}</strong><small>{shortTeamName(game.home.name)}</small>{favorite === 'home' ? <em>FAVORITO</em> : null}
                    </div>
                  </div>

                  <div className="mlb-moneyline">
                    <span className="mlb-moneyline-label">MONEYLINE {game.books.length ? `· ${game.books.length} ${game.books.length === 1 ? 'CASA' : 'CASAS'}` : ''}</span>
                    <div className="mlb-moneyline-values">
                      <div className={`mlb-odd-side away ${favorite === 'away' ? 'favorite' : ''}`}><small>{game.away.abbreviation}</small><strong>{odd(game.consensusAway)}</strong></div>
                      <span className="mlb-market-label">{marketLabel(game)}</span>
                      <div className={`mlb-odd-side home ${favorite === 'home' ? 'favorite' : ''}`}><small>{game.home.abbreviation}</small><strong>{odd(game.consensusHome)}</strong></div>
                    </div>
                  </div>

                  {game.books.length ? <div className="mlb-books">
                    <div className="mlb-books-head"><span>CASA</span><b>{game.away.abbreviation}</b><b>{game.home.abbreviation}</b></div>
                    {game.books.slice(0, 5).map((book) => {
                      const bookFavorite = favoriteFromOdds(book.away, book.home);
                      return <div key={`${game.id}-${book.provider}`}><span>{book.provider}</span><b className={bookFavorite === 'away' ? 'is-favorite' : ''}>{odd(book.away)}</b><b className={bookFavorite === 'home' ? 'is-favorite' : ''}>{odd(book.home)}</b></div>;
                    })}
                  </div> : <div className="mlb-no-odds">Momio todavía no publicado.</div>}
                </article>
              );
            })}
          </div>

          {snapshot ? <div className="mlb-updated">Actualizado {new Date(snapshot.updatedAt).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}</div> : null}
        </section>
      </div>
    </section>
  );
}
