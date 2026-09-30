import { useEffect, useMemo, useState } from 'react';
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

type FormView = {
  last5: { wins: number; losses: number; sequence: string[] };
  last10: { wins: number; losses: number; sequence: string[] };
  games: Array<{ date: string; result: 'W' | 'L'; opponent: string; score?: string }>;
  sourceSeason?: number;
};

type InjuryView = { name: string; status: string; detail?: string };
type SportsContext = {
  updatedAt: string;
  form: { away: FormView | null; home: FormView | null };
  probablePitchers?: { away?: string; home?: string };
  lineups: { away: string[]; home: string[]; status: 'published' | 'unavailable' };
  injuries: { away: InjuryView[]; home: InjuryView[] };
  warnings?: string[];
};

type OddsPoint = { away?: number; home?: number; at: string };

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

function eventDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function formRecord(form: FormView | null | undefined, size: 5 | 10) {
  if (!form) return '—';
  const block = size === 5 ? form.last5 : form.last10;
  return `${block.wins}-${block.losses}`;
}

function sequence(form: FormView | null | undefined, size: 5 | 10) {
  if (!form) return [];
  return (size === 5 ? form.last5.sequence : form.last10.sequence).slice(0, size);
}

function readOddsHistory(key: string): OddsPoint[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) as OddsPoint[] : [];
    return Array.isArray(parsed) ? parsed.slice(-24) : [];
  } catch {
    return [];
  }
}

function sameOdds(point: OddsPoint | undefined, away?: number, home?: number) {
  return Boolean(point && point.away === away && point.home === home);
}

export default function SportsGameDetail({ sport, game, standings, onBack }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sportsContext, setSportsContext] = useState<SportsContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState('');

  const storageKey = `dj-noa-sports-odds-${sport.toLowerCase()}-${game.id}`;
  const [oddsHistory, setOddsHistory] = useState<OddsPoint[]>(() => readOddsHistory(storageKey));

  useEffect(() => {
    if (game.consensusAway === undefined && game.consensusHome === undefined) return;
    setOddsHistory((current) => {
      const last = current[current.length - 1];
      if (sameOdds(last, game.consensusAway, game.consensusHome)) return current;
      const next = [...current, { away: game.consensusAway, home: game.consensusHome, at: new Date().toISOString() }].slice(-24);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* best effort */ }
      return next;
    });
  }, [storageKey, game.consensusAway, game.consensusHome]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      sport,
      gameId: game.id,
      date: eventDate(game.startTime),
      away: game.away.abbreviation,
      home: game.home.abbreviation,
      awayName: game.away.name,
      homeName: game.home.name
    });
    setContextLoading(true);
    setContextError('');
    void fetch(`/api/sports-context?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`context_${response.status}`);
        return response.json() as Promise<SportsContext>;
      })
      .then((data) => setSportsContext(data))
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setContextError('Contexto ampliado no disponible por ahora.');
      })
      .finally(() => setContextLoading(false));
    return () => controller.abort();
  }, [sport, game.id, game.startTime, game.away.abbreviation, game.away.name, game.home.abbreviation, game.home.name]);

  const awayStanding = standings.find((row) => row.abbreviation === game.away.abbreviation);
  const homeStanding = standings.find((row) => row.abbreviation === game.home.abbreviation);
  const priorPoint = oddsHistory.length > 1 ? oddsHistory[oddsHistory.length - 2] : null;
  const firstPoint = oddsHistory[0] || null;
  const awayMove = movement(game.consensusAway, priorPoint?.away);
  const homeMove = movement(game.consensusHome, priorPoint?.home);
  const recentHistory = useMemo(() => oddsHistory.slice(-6), [oddsHistory]);

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sports-analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sport, game, awayStanding, homeStanding, sportsContext })
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
            <div><small>{game.away.abbreviation}</small><strong>{odd(game.consensusAway)}</strong>{awayMove ? <span className={awayMove}>{awayMove === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}{awayMove === 'up' ? 'sube' : 'baja'}</span> : <span>sin cambio</span>}</div>
            <div><small>{game.home.abbreviation}</small><strong>{odd(game.consensusHome)}</strong>{homeMove ? <span className={homeMove}>{homeMove === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}{homeMove === 'up' ? 'sube' : 'baja'}</span> : <span>sin cambio</span>}</div>
          </div>
          {firstPoint && oddsHistory.length > 1 ? <div className="sports-opening-row">
            <span>PRIMER REGISTRO</span><b>{game.away.abbreviation} {odd(firstPoint.away)}</b><b>{game.home.abbreviation} {odd(firstPoint.home)}</b>
          </div> : null}
          {game.books.length ? <div className="sports-books">
            <div className="sports-books-head"><span>CASA</span><b>{game.away.abbreviation}</b><b>{game.home.abbreviation}</b></div>
            {game.books.map((book) => <div key={`${game.id}-${book.provider}`}><span>{book.provider}</span><b>{odd(book.away)}</b><b>{odd(book.home)}</b></div>)}
          </div> : <div className="sports-empty">Momios todavía no publicados.</div>}
          {recentHistory.length > 1 ? <div className="sports-odds-history">
            <div className="sports-mini-title">HISTORIAL EN ESTE DISPOSITIVO</div>
            {recentHistory.map((point, index) => <div key={`${point.at}-${index}`}><span>{new Date(point.at).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}</span><b>{odd(point.away)}</b><b>{odd(point.home)}</b></div>)}
          </div> : null}
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>FORMA</span><h3>Últimos 5 / 10</h3></div>
          {contextLoading ? <div className="sports-empty">Actualizando forma reciente…</div> : null}
          {!contextLoading ? <div className="sports-form-grid">
            <div>
              <small>{game.away.abbreviation}</small><strong>{formRecord(sportsContext?.form.away, 5)} <em>L5</em></strong><b>{formRecord(sportsContext?.form.away, 10)} <em>L10</em></b>
              <div className="sports-form-sequence">{sequence(sportsContext?.form.away, 5).map((value, index) => <span className={value === 'W' ? 'win' : 'loss'} key={`${value}-${index}`}>{value}</span>)}</div>
            </div>
            <div>
              <small>{game.home.abbreviation}</small><strong>{formRecord(sportsContext?.form.home, 5)} <em>L5</em></strong><b>{formRecord(sportsContext?.form.home, 10)} <em>L10</em></b>
              <div className="sports-form-sequence">{sequence(sportsContext?.form.home, 5).map((value, index) => <span className={value === 'W' ? 'win' : 'loss'} key={`${value}-${index}`}>{value}</span>)}</div>
            </div>
          </div> : null}
          {contextError ? <div className="sports-empty compact">{contextError}</div> : null}
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>CONTEXTO</span><h3>Cómo llegan</h3></div>
          <div className="sports-context-grid">
            <div><small>{game.away.abbreviation}</small><strong>{awayStanding ? `${awayStanding.wins}-${awayStanding.losses}` : '—'}</strong><span>{awayStanding ? `${awayStanding.pct} · #${awayStanding.rank}` : 'Sin tabla disponible'}</span></div>
            <div><small>{game.home.abbreviation}</small><strong>{homeStanding ? `${homeStanding.wins}-${homeStanding.losses}` : '—'}</strong><span>{homeStanding ? `${homeStanding.pct} · #${homeStanding.rank}` : 'Sin tabla disponible'}</span></div>
          </div>
        </section>

        {sport === 'MLB' ? <section className="sports-card">
          <div className="sports-card-title"><span>ABRIDORES</span><h3>Pitchers probables</h3></div>
          <div className="sports-pitcher-grid">
            <div><small>{game.away.abbreviation}</small><strong>{sportsContext?.probablePitchers?.away || 'Por confirmar'}</strong></div>
            <div><small>{game.home.abbreviation}</small><strong>{sportsContext?.probablePitchers?.home || 'Por confirmar'}</strong></div>
          </div>
        </section> : null}

        <section className="sports-card">
          <div className="sports-card-title"><span>DISPONIBILIDAD</span><h3>Lesiones reportadas</h3></div>
          <div className="sports-injury-grid">
            <div><small>{game.away.abbreviation}</small>{sportsContext?.injuries.away.length ? sportsContext.injuries.away.slice(0, 5).map((item) => <div className="sports-injury" key={`${game.away.abbreviation}-${item.name}`}><strong>{item.name}</strong><span>{item.status}{item.detail ? ` · ${item.detail}` : ''}</span></div>) : <span className="sports-none">Sin reporte disponible.</span>}</div>
            <div><small>{game.home.abbreviation}</small>{sportsContext?.injuries.home.length ? sportsContext.injuries.home.slice(0, 5).map((item) => <div className="sports-injury" key={`${game.home.abbreviation}-${item.name}`}><strong>{item.name}</strong><span>{item.status}{item.detail ? ` · ${item.detail}` : ''}</span></div>) : <span className="sports-none">Sin reporte disponible.</span>}</div>
          </div>
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>{sport === 'MLB' ? 'LINEUP' : 'STARTERS'}</span><h3>{sportsContext?.lineups.status === 'published' ? 'Publicados' : 'Aún no publicados'}</h3></div>
          {sportsContext?.lineups.status === 'published' ? <div className="sports-lineup-grid">
            <div><small>{game.away.abbreviation}</small>{sportsContext.lineups.away.map((name, index) => <span key={`${game.away.abbreviation}-${name}`}>{index + 1}. {name}</span>)}</div>
            <div><small>{game.home.abbreviation}</small>{sportsContext.lineups.home.map((name, index) => <span key={`${game.home.abbreviation}-${name}`}>{index + 1}. {name}</span>)}</div>
          </div> : <div className="sports-empty compact">La fuente todavía no publica una alineación confirmada para este juego.</div>}
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
