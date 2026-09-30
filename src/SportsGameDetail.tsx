import { useMemo, useState } from 'react';
import { ArrowLeft, Brain, TrendingDown, TrendingUp } from 'lucide-react';

type BookOdds = { provider: string; away: number; home: number };
type Standing = {
  conference?: string;
  division?: string;
  team: string;
  abbreviation: string;
  wins: number;
  losses: number;
  pct: string;
  gamesBack: string;
  rank: number;
};
type Game = {
  id: string;
  startTime: string;
  status: 'scheduled' | 'live' | 'final';
  statusText: string;
  venue?: string;
  away: { name: string; abbreviation: string; logo?: string; score?: string };
  home: { name: string; abbreviation: string; logo?: string; score?: string };
  consensusAway?: number;
  consensusHome?: number;
  books: BookOdds[];
};

type Props = {
  sport: 'MLB' | 'NBA';
  game: Game;
  standings: Standing[];
  onBack: () => void;
};

type Analysis = {
  summary: string;
  market: string;
  edge: string;
  risks: string[];
};

type StoredOdds = { away?: number; home?: number; at: string };

function odd(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;
}

function implied(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 0;
  return value < 0 ? (-value) / ((-value) + 100) : 100 / (value + 100);
}

function movement(current?: number, previous?: number) {
  if (current === undefined || previous === undefined || current === previous) return null;
  const currentP = implied(current);
  const previousP = implied(previous);
  if (!currentP || !previousP) return null;
  return currentP > previousP ? 'up' : 'down';
}

function shortTeam(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(-1)[0] : name;
}

export default function SportsGameDetail({ sport, game, standings, onBack }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const storageKey = `dj-noa-sports-odds-${sport.toLowerCase()}-${game.id}`;
  const previous = useMemo<StoredOdds | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) as StoredOdds : null;
    } catch { return null; }
  }, [storageKey]);

  useMemo(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ away: game.consensusAway, home: game.consensusHome, at: new Date().toISOString() } satisfies StoredOdds));
    } catch { /* best effort */ }
    return null;
  }, [storageKey, game.consensusAway, game.consensusHome]);

  const awayStanding = standings.find((row) => row.abbreviation === game.away.abbreviation);
  const homeStanding = standings.find((row) => row.abbreviation === game.home.abbreviation);
  const awayMove = movement(game.consensusAway, previous?.away);
  const homeMove = movement(game.consensusHome, previous?.home);

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sports-analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sport, game, awayStanding, homeStanding })
      });
      if (!response.ok) throw new Error(`analysis_${response.status}`);
      const data = await response.json() as Analysis;
      setAnalysis(data);
    } catch {
      setError('No pude generar el análisis en este momento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={`sports-detail ${sport.toLowerCase()}`}>
      <div className="sports-detail-scroll">
        <header className="sports-detail-head">
          <button onClick={onBack} aria-label="Volver"><ArrowLeft size={26} /></button>
          <div><span>{sport} · MATCHUP</span><h2>{game.away.abbreviation} vs {game.home.abbreviation}</h2></div>
        </header>

        <section className="sports-hero-card">
          <div className="sports-status-row"><span>{game.status === 'live' ? 'EN VIVO' : game.status === 'final' ? 'FINAL' : 'PROGRAMADO'}</span><small>{game.statusText}</small></div>
          <div className="sports-team-grid">
            <div className="sports-team-block">
              {game.away.logo ? <img src={game.away.logo} alt="" /> : null}
              <strong>{game.away.abbreviation}</strong><span>{shortTeam(game.away.name)}</span>
              {game.away.score ? <b>{game.away.score}</b> : null}
            </div>
            <div className="sports-vs">VS</div>
            <div className="sports-team-block">
              {game.home.logo ? <img src={game.home.logo} alt="" /> : null}
              <strong>{game.home.abbreviation}</strong><span>{shortTeam(game.home.name)}</span>
              {game.home.score ? <b>{game.home.score}</b> : null}
            </div>
          </div>
          <div className="sports-meta">{game.venue || sport} · {new Date(game.startTime).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div>
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>MERCADO</span><h3>Momios y movimiento</h3></div>
          <div className="sports-consensus-grid">
            <div><small>{game.away.abbreviation}</small><strong>{odd(game.consensusAway)}</strong>{awayMove ? <span className={awayMove}><>{awayMove === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</>{awayMove === 'up' ? 'sube' : 'baja'}</span> : <span>sin cambio</span>}</div>
            <div><small>{game.home.abbreviation}</small><strong>{odd(game.consensusHome)}</strong>{homeMove ? <span className={homeMove}><>{homeMove === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</>{homeMove === 'up' ? 'sube' : 'baja'}</span> : <span>sin cambio</span>}</div>
          </div>
          {game.books.length ? <div className="sports-books">
            <div className="sports-books-head"><span>CASA</span><b>{game.away.abbreviation}</b><b>{game.home.abbreviation}</b></div>
            {game.books.map((book) => <div key={`${game.id}-${book.provider}`}><span>{book.provider}</span><b>{odd(book.away)}</b><b>{odd(book.home)}</b></div>)}
          </div> : <div className="sports-empty">Momios todavía no publicados.</div>}
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>CONTEXTO</span><h3>Cómo llegan</h3></div>
          <div className="sports-context-grid">
            <div><small>{game.away.abbreviation}</small><strong>{awayStanding ? `${awayStanding.wins}-${awayStanding.losses}` : '—'}</strong><span>{awayStanding ? `${awayStanding.pct} · #${awayStanding.rank}` : 'Sin tabla disponible'}</span></div>
            <div><small>{game.home.abbreviation}</small><strong>{homeStanding ? `${homeStanding.wins}-${homeStanding.losses}` : '—'}</strong><span>{homeStanding ? `${homeStanding.pct} · #${homeStanding.rank}` : 'Sin tabla disponible'}</span></div>
          </div>
        </section>

        <section className="sports-card sports-ai-card">
          <div className="sports-card-title"><span>DJ NOA</span><h3>Análisis IA</h3></div>
          {!analysis ? <button className="sports-ai-button" onClick={() => void runAnalysis()} disabled={loading}><Brain size={20} />{loading ? 'ANALIZANDO…' : 'ANALIZAR PARTIDO'}</button> : null}
          {error ? <div className="sports-empty">{error}</div> : null}
          {analysis ? <div className="sports-analysis">
            <p>{analysis.summary}</p>
            <div><span>MERCADO</span><strong>{analysis.market}</strong></div>
            <div><span>LECTURA</span><strong>{analysis.edge}</strong></div>
            {analysis.risks?.length ? <ul>{analysis.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : null}
          </div> : null}
        </section>
      </div>
    </section>
  );
}
