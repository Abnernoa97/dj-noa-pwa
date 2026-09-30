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
  updatedAt: string;
  games: MlbGame[];
  standings: MlbStanding[];
  warnings?: string[];
};

type Props = {
  onBack: () => void;
};

const CACHE_KEY = 'dj-noa-mlb-snapshot-v1';

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

function standingsDateLabel(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return Number.isFinite(value.getTime())
    ? format(value, "d 'de' MMMM", { locale: es })
    : date;
}

export default function MlbWorkspace({ onBack }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [snapshot, setSnapshot] = useState<MlbSnapshot | null>(() => {
    const cached = readCachedSnapshot();
    return cached?.date === today ? cached : null;
  });
  const [league, setLeague] = useState<'AL' | 'NL'>('AL');
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
    return Array.from(grouped.entries()).map(([name, rows]) => [name, rows.sort((a, b) => a.rank - b.rank)] as const);
  }, [snapshot, league]);

  return (
    <section className="mlb-workspace">
      <header className="mlb-page-head">
        <button className="mlb-back" onClick={onBack} aria-label="Volver a Inicio"><ArrowLeft size={22} /></button>
        <div className="mlb-brand-lockup">
          <img src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg" alt="MLB" />
          <div><span>DAILY BOARD</span><strong>{standingsDateLabel(today)}</strong></div>
        </div>
        <button className={`mlb-refresh ${refreshing ? 'spinning' : ''}`} onClick={() => void load(true)} disabled={refreshing} aria-label="Actualizar MLB"><RefreshCw size={20} /></button>
      </header>

      <div className="mlb-page-scroll">
        <section className="mlb-standings-panel">
          <div className="mlb-section-head">
            <div><span>MLB 2026</span><h2>Posiciones</h2></div>
            <Trophy size={22} />
          </div>
          <div className="mlb-league-tabs" role="tablist" aria-label="Liga">
            <button className={league === 'AL' ? 'active' : ''} onClick={() => setLeague('AL')}>AMERICANA</button>
            <button className={league === 'NL' ? 'active' : ''} onClick={() => setLeague('NL')}>NACIONAL</button>
          </div>

          {loading && !snapshot ? <div className="mlb-loading">Actualizando posiciones…</div> : null}
          {!loading && !divisions.length ? <div className="mlb-empty-line">Posiciones no disponibles por ahora.</div> : null}

          <div className="mlb-divisions">
            {divisions.map(([division, rows]) => (
              <div className="mlb-division" key={`${league}-${division}`}>
                <div className="mlb-division-title">{division}</div>
                <div className="mlb-standings-grid mlb-standings-labels"><span>EQ</span><span>G</span><span>P</span><span>PCT</span><span>DIF</span></div>
                {rows.map((row) => (
                  <div className="mlb-standings-grid" key={`${division}-${row.abbreviation}`}>
                    <span className="mlb-team-cell"><b>{row.rank}</b><strong>{row.abbreviation}</strong><small>{shortTeamName(row.team)}</small></span>
                    <span>{row.wins}</span><span>{row.losses}</span><span>{row.pct}</span><span>{row.gamesBack === '-' ? '—' : row.gamesBack}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="mlb-games-section">
          <div className="mlb-games-title">
            <div><span>HOY</span><h2>Juegos programados</h2></div>
            <small>{snapshot?.games.length || 0} juegos</small>
          </div>

          {error ? <div className="mlb-data-note">{error}</div> : null}
          {loading && !snapshot ? <div className="mlb-loading games">Buscando juegos y momios…</div> : null}
          {!loading && snapshot && !snapshot.games.length ? <div className="mlb-no-games">No hay juegos programados para hoy.</div> : null}

          <div className="mlb-games-list">
            {(snapshot?.games || []).map((game, index) => (
              <article className={`mlb-game-card ${index % 2 ? 'red-edge' : 'blue-edge'}`} key={game.id}>
                <div className="mlb-game-meta"><span className={`mlb-status ${game.status}`}>{gameClock(game)}</span><small>{game.venue || 'MLB'}</small></div>

                <div className="mlb-matchup">
                  <div className="mlb-club away">
                    {game.away.logo ? <img src={game.away.logo} alt="" /> : <span className="mlb-logo-fallback">{game.away.abbreviation.slice(0, 1)}</span>}
                    <strong>{game.away.abbreviation}</strong>
                    <small>{shortTeamName(game.away.name)}</small>
                  </div>
                  <div className="mlb-versus"><span>VS</span>{game.status !== 'scheduled' && (game.away.score || game.home.score) ? <b>{game.away.score || '0'} · {game.home.score || '0'}</b> : null}</div>
                  <div className="mlb-club home">
                    {game.home.logo ? <img src={game.home.logo} alt="" /> : <span className="mlb-logo-fallback">{game.home.abbreviation.slice(0, 1)}</span>}
                    <strong>{game.home.abbreviation}</strong>
                    <small>{shortTeamName(game.home.name)}</small>
                  </div>
                </div>

                <div className="mlb-moneyline">
                  <span className="mlb-moneyline-label">MONEYLINE {game.books.length ? `· ${game.books.length} ${game.books.length === 1 ? 'CASA' : 'CASAS'}` : ''}</span>
                  <div className="mlb-moneyline-values"><strong>{odd(game.consensusAway)}</strong><span>CONSENSO</span><strong>{odd(game.consensusHome)}</strong></div>
                </div>

                {game.books.length ? <div className="mlb-books">
                  {game.books.slice(0, 3).map((book) => <div key={`${game.id}-${book.provider}`}><span>{book.provider}</span><b>{odd(book.away)}</b><b>{odd(book.home)}</b></div>)}
                </div> : <div className="mlb-no-odds">Momio todavía no publicado.</div>}
              </article>
            ))}
          </div>

          {snapshot ? <div className="mlb-updated">Actualizado {new Date(snapshot.updatedAt).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}</div> : null}
        </section>
      </div>
    </section>
  );
}
