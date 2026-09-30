import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type MlbBookOdds = {
  provider: string;
  away: number;
  home: number;
};

type MlbGame = {
  id: string;
  startTime: string;
  status: 'scheduled' | 'live' | 'final';
  statusText: string;
  venue?: string;
  away: { name: string; abbreviation: string; logo?: string; score?: string };
  home: { name: string; abbreviation: string; logo?: string; score?: string };
  consensusAway?: number;
  consensusHome?: number;
  books: MlbBookOdds[];
};

type MlbStanding = {
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

type MlbSnapshot = {
  date: string;
  nextDate?: string;
  updatedAt: string;
  games: MlbGame[];
  nextGames?: MlbGame[];
  standings: MlbStanding[];
  warnings?: string[];
};

type Props = {
  onBack: () => void;
};

type FavoriteSide = 'away' | 'home' | null;

const CACHE_KEY = 'dj-noa-mlb-snapshot-v3';
const DIVISION_ORDER = ['Este', 'Central', 'Oeste'];

function readCachedSnapshot(): MlbSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as MlbSnapshot : null;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(snapshot: MlbSnapshot) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot)); } catch { /* best effort */ }
}

function odd(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;
}

function impliedProbability(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 0;
  return value < 0 ? (-value) / ((-value) + 100) : 100 / (value + 100);
}

function favoriteFromOdds(away?: number, home?: number): FavoriteSide {
  const awayProbability = impliedProbability(away);
  const homeProbability = impliedProbability(home);
  if (!awayProbability || !homeProbability || Math.abs(awayProbability - homeProbability) < 0.0001) return null;
  return awayProbability > homeProbability ? 'away' : 'home';
}

function favoriteForGame(game: MlbGame): FavoriteSide {
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

function shortTeamName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(-1)[0] : name;
}

function gameClock(game: MlbGame) {
  if (game.status === 'live') return game.statusText || 'EN VIVO';
  if (game.status === 'final') return game.statusText || 'FINAL';
  const date = new Date(game.startTime);
  if (!Number.isFinite(date.getTime())) return game.statusText || 'Programado';
  return date.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
}

function dateLabel(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return Number.isFinite(value.getTime())
    ? format(value, "d 'de' MMMM", { locale: es })
    : date;
}

function marketLabel(game: MlbGame) {
  if (game.books.length > 1) return 'PROMEDIO';
  if (game.books.length === 1) return game.books[0].provider.toUpperCase();
  return 'MERCADO';
}

export default function MlbWorkspace({ onBack }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [snapshot, setSnapshot] = useState<MlbSnapshot | null>(() => {
    const cached = readCachedSnapshot();
    return cached?.date === today ? cached : null;
  });
  const [league, setLeague] = useState<'AL' | 'NL'>('AL');
  const [division, setDivision] = useState('Este');
  const [loading, setLoading] = useState(!snapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch(`/api/mlb?date=${today}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`mlb_${response.status}`);
      const data = await response.json() as MlbSnapshot;
      setSnapshot(data);
      writeCachedSnapshot(data);
      setError('');
    } catch {
      const cached = readCachedSnapshot();
      if (cached?.date === today) setSnapshot(cached);
      setError(cached?.date === today ? 'Mostrando la última actualización guardada.' : 'No pude actualizar MLB en este momento.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(false), 3 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  const divisions = useMemo(() => {
    const grouped = new Map<string, MlbStanding[]>();
    for (const row of snapshot?.standings || []) {
      if (row.league !== league) continue;
      const current = grouped.get(row.division) || [];
      current.push(row);
      grouped.set(row.division, current);
    }
    return Array.from(grouped.entries())
      .map(([name, rows]) => [name, rows.sort((a, b) => a.rank - b.rank)] as const)
      .sort(([a], [b]) => {
        const ai = DIVISION_ORDER.indexOf(a);
        const bi = DIVISION_ORDER.indexOf(b);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
      });
  }, [snapshot, league]);

  useEffect(() => {
    if (!divisions.length) return;
    if (!divisions.some(([name]) => name === division)) setDivision(divisions[0][0]);
  }, [divisions, division]);

  const activeRows = useMemo(
    () => divisions.find(([name]) => name === division)?.[1] || divisions[0]?.[1] || [],
    [divisions, division]
  );

  const todayGames = useMemo(() => {
    return (snapshot?.games || [])
      .filter((game) => game.status !== 'final')
      .sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === 'live') return -1;
          if (b.status === 'live') return 1;
        }
        const aTime = new Date(a.startTime).getTime();
        const bTime = new Date(b.startTime).getTime();
        return (Number.isFinite(aTime) ? aTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bTime) ? bTime : Number.MAX_SAFE_INTEGER);
      });
  }, [snapshot]);

  const nextGames = useMemo(
    () => (snapshot?.nextGames || []).filter((game) => game.status !== 'final'),
    [snapshot]
  );

  const showingToday = todayGames.length > 0;
  const displayedGames = showingToday ? todayGames : nextGames;
  const gamesDate = showingToday ? today : (snapshot?.nextDate || today);
  const hasLive = displayedGames.some((game) => game.status === 'live');

  return (
    <section className="mlb-workspace">
      <header className="mlb-page-head">
        <button className="mlb-back" onClick={onBack} aria-label="Volver a Inicio"><ArrowLeft size={26} /></button>
        <div className="mlb-brand-lockup">
          <img src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg" alt="MLB" />
          <div><span>DAILY BOARD</span><strong>{dateLabel(today)}</strong></div>
        </div>
        <button className={`mlb-refresh ${refreshing ? 'spinning' : ''}`} onClick={() => void load(true)} disabled={refreshing} aria-label="Actualizar MLB"><RefreshCw size={24} /></button>
      </header>

      <div className="mlb-page-scroll">
        <section className="mlb-standings-panel">
          <div className="mlb-section-head">
            <div><span>MLB 2026</span><h2>Tabla de posiciones</h2></div>
            <Trophy size={28} />
          </div>

          <div className="mlb-league-tabs" role="tablist" aria-label="Liga">
            <button className={league === 'AL' ? 'active' : ''} onClick={() => setLeague('AL')}>AMERICANA</button>
            <button className={league === 'NL' ? 'active' : ''} onClick={() => setLeague('NL')}>NACIONAL</button>
          </div>

          {divisions.length ? <div className="mlb-division-tabs" role="tablist" aria-label="División">
            {divisions.map(([name]) => <button key={`${league}-${name}`} className={division === name ? 'active' : ''} onClick={() => setDivision(name)}>{name.toUpperCase()}</button>)}
          </div> : null}

          {loading && !snapshot ? <div className="mlb-loading">Actualizando tabla de posiciones…</div> : null}
          {!loading && !divisions.length ? <div className="mlb-empty-line">Posiciones no disponibles por ahora.</div> : null}

          {activeRows.length ? <div className="mlb-division active">
            <div className="mlb-division-title">{league === 'AL' ? 'Liga Americana' : 'Liga Nacional'} · {division}</div>
            <div className="mlb-standings-grid mlb-standings-labels"><span>EQUIPO</span><span>G</span><span>P</span><span>PCT</span><span>DIF</span></div>
            {activeRows.map((row) => (
              <div className="mlb-standings-grid" key={`${division}-${row.abbreviation}`}>
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
          {!loading && snapshot && !displayedGames.length ? <div className="mlb-no-games">No quedan juegos de hoy ni hay juegos programados para el siguiente día.</div> : null}

          <div className="mlb-games-list">
            {displayedGames.map((game, index) => {
              const favorite = favoriteForGame(game);
              return (
                <article className={`mlb-game-card ${index % 2 ? 'red-edge' : 'blue-edge'} ${game.status === 'live' ? 'is-live-card' : ''}`} key={game.id}>
                  <div className="mlb-game-meta"><span className={`mlb-status ${game.status}`}>{gameClock(game)}</span><small>{game.venue || 'MLB'}</small></div>

                  <div className="mlb-matchup">
                    <div className={`mlb-club away ${favorite === 'away' ? 'market-favorite' : ''}`}>
                      {game.away.logo ? <img src={game.away.logo} alt="" /> : <span className="mlb-logo-fallback">{game.away.abbreviation.slice(0, 1)}</span>}
                      <strong>{game.away.abbreviation}</strong>
                      <small>{shortTeamName(game.away.name)}</small>
                      {favorite === 'away' ? <em>FAVORITO</em> : null}
                    </div>
                    <div className="mlb-versus"><span>VS</span>{game.status !== 'scheduled' && (game.away.score || game.home.score) ? <b>{game.away.score || '0'} · {game.home.score || '0'}</b> : null}</div>
                    <div className={`mlb-club home ${favorite === 'home' ? 'market-favorite' : ''}`}>
                      {game.home.logo ? <img src={game.home.logo} alt="" /> : <span className="mlb-logo-fallback">{game.home.abbreviation.slice(0, 1)}</span>}
                      <strong>{game.home.abbreviation}</strong>
                      <small>{shortTeamName(game.home.name)}</small>
                      {favorite === 'home' ? <em>FAVORITO</em> : null}
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
                  </div> : <div className="mlb-no-odds">Momio todavía no publicado por las casas.</div>}
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
