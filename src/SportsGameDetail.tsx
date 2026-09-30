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
type Lineups = { away: string[]; home: string[]; status: 'published' | 'unavailable' };
type SportsContext = {
  updatedAt: string;
  form: { away: FormView | null; home: FormView | null };
  probablePitchers?: { away?: string; home?: string };
  lineups: Lineups;
  injuries: { away: InjuryView[]; home: InjuryView[] };
  warnings?: string[];
};
type LivePayload = {
  updatedAt: string;
  game?: Game;
  form?: { away: FormView | null; home: FormView | null };
  probablePitchers?: { away?: string; home?: string };
  lineups?: Lineups;
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

function mergeLiveGame(previous: Game, incoming?: Game) {
  if (!incoming) return previous;
  return {
    ...previous,
    ...incoming,
    away: { ...previous.away, ...incoming.away },
    home: { ...previous.home, ...incoming.home },
    books: incoming.books?.length ? incoming.books : previous.books,
    consensusAway: incoming.consensusAway ?? previous.consensusAway,
    consensusHome: incoming.consensusHome ?? previous.consensusHome
  };
}

export default function SportsGameDetail({ sport, game, standings, onBack }: Props) {
  const [activeGame, setActiveGame] = useState<Game>(game);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sportsContext, setSportsContext] = useState<SportsContext | null>(null);
  const [livePayload, setLivePayload] = useState<LivePayload | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState('');
  const [liveError, setLiveError] = useState('');

  useEffect(() => setActiveGame(game), [game]);

  const storageKey = `dj-noa-sports-odds-${sport.toLowerCase()}-${activeGame.id}`;
  const [oddsHistory, setOddsHistory] = useState<OddsPoint[]>(() => readOddsHistory(storageKey));

  useEffect(() => {
    setOddsHistory(readOddsHistory(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (activeGame.consensusAway === undefined && activeGame.consensusHome === undefined) return;
    setOddsHistory((current) => {
      const last = current[current.length - 1];
      if (sameOdds(last, activeGame.consensusAway, activeGame.consensusHome)) return current;
      const next = [...current, { away: activeGame.consensusAway, home: activeGame.consensusHome, at: new Date().toISOString() }].slice(-24);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* best effort */ }
      return next;
    });
  }, [storageKey, activeGame.consensusAway, activeGame.consensusHome]);

  useEffect(() => {
    let disposed = false;
    let timer = 0;

    const params = new URLSearchParams({
      sport,
      gameId: game.id,
      date: eventDate(game.startTime),
      away: game.away.abbreviation,
      home: game.home.abbreviation,
      awayName: game.away.name,
      homeName: game.home.name
    });

    const loadLive = async () => {
      try {
        const response = await fetch(`/api/sports-live?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`live_${response.status}`);
        const data = await response.json() as LivePayload;
        if (disposed) return;
        setLivePayload(data);
        if (data.game) setActiveGame((current) => mergeLiveGame(current, data.game));
        setLiveError('');
      } catch {
        if (!disposed) setLiveError('Actualización en vivo temporalmente no disponible.');
      }
    };

    const schedule = () => {
      window.clearInterval(timer);
      const interval = activeGame.status === 'live' ? 15000 : 30000;
      timer = window.setInterval(() => void loadLive(), interval);
    };

    void loadLive();
    schedule();
    const onVisible = () => { if (document.visibilityState === 'visible') void loadLive(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sport, game.id, game.startTime, game.away.abbreviation, game.away.name, game.home.abbreviation, game.home.name, activeGame.status]);

  useEffect(() => {
    let disposed = false;
    let first = true;
    const params = new URLSearchParams({
      sport,
      gameId: game.id,
      date: eventDate(game.startTime),
      away: game.away.abbreviation,
      home: game.home.abbreviation,
      awayName: game.away.name,
      homeName: game.home.name
    });

    const loadContext = async () => {
      if (first) setContextLoading(true);
      try {
        const response = await fetch(`/api/sports-context?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`context_${response.status}`);
        const data = await response.json() as SportsContext;
        if (disposed) return;
        setSportsContext(data);
        setContextError('');
      } catch {
        if (!disposed) setContextError('Contexto ampliado no disponible por ahora.');
      } finally {
        if (!disposed && first) setContextLoading(false);
        first = false;
      }
    };

    void loadContext();
    const timer = window.setInterval(() => void loadContext(), 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') void loadContext(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sport, game.id, game.startTime, game.away.abbreviation, game.away.name, game.home.abbreviation, game.home.name]);

  const effectiveContext = useMemo<SportsContext>(() => {
    const fallbackLineups: Lineups = { away: [], home: [], status: 'unavailable' };
    const liveLineups = livePayload?.lineups;
    const baseLineups = sportsContext?.lineups || fallbackLineups;
    const lineups = liveLineups && (liveLineups.status === 'published' || baseLineups.status !== 'published') ? liveLineups : baseLineups;
    return {
      updatedAt: livePayload?.updatedAt || sportsContext?.updatedAt || '',
      form: livePayload?.form || sportsContext?.form || { away: null, home: null },
      probablePitchers: livePayload?.probablePitchers || sportsContext?.probablePitchers,
      lineups,
      injuries: sportsContext?.injuries || { away: [], home: [] },
      warnings: [...(sportsContext?.warnings || []), ...(livePayload?.warnings || [])]
    };
  }, [livePayload, sportsContext]);

  const awayStanding = standings.find((row) => row.abbreviation === activeGame.away.abbreviation);
  const homeStanding = standings.find((row) => row.abbreviation === activeGame.home.abbreviation);
  const priorPoint = oddsHistory.length > 1 ? oddsHistory[oddsHistory.length - 2] : null;
  const firstPoint = oddsHistory[0] || null;
  const awayMove = movement(activeGame.consensusAway, priorPoint?.away);
  const homeMove = movement(activeGame.consensusHome, priorPoint?.home);
  const recentHistory = useMemo(() => oddsHistory.slice(-6), [oddsHistory]);
  const lastUpdated = livePayload?.updatedAt || effectiveContext.updatedAt;

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sports-analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sport, game: activeGame, awayStanding, homeStanding, sportsContext: effectiveContext })
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
          <div><span>{sport} · MATCHUP</span><h2>{activeGame.away.abbreviation} vs {activeGame.home.abbreviation}</h2></div>
        </header>

        <div className="sports-realtime-strip">
          <span className="sports-live-dot" />
          <strong>ACTUALIZACIÓN AUTOMÁTICA</strong>
          <small>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'conectando…'}</small>
        </div>

        <section className="sports-hero-card">
          <div className="sports-status-row"><span>{activeGame.status === 'live' ? 'EN VIVO' : activeGame.status === 'final' ? 'FINAL' : 'PROGRAMADO'}</span><small>{activeGame.statusText}</small></div>
          <div className="sports-team-grid">
            <div className="sports-team-block">
              {activeGame.away.logo ? <img src={activeGame.away.logo} alt="" /> : null}
              <strong>{activeGame.away.abbreviation}</strong><span>{shortTeam(activeGame.away.name)}</span>
              {activeGame.away.score ? <b>{activeGame.away.score}</b> : null}
            </div>
            <div className="sports-vs">VS</div>
            <div className="sports-team-block">
              {activeGame.home.logo ? <img src={activeGame.home.logo} alt="" /> : null}
              <strong>{activeGame.home.abbreviation}</strong><span>{shortTeam(activeGame.home.name)}</span>
              {activeGame.home.score ? <b>{activeGame.home.score}</b> : null}
            </div>
          </div>
          <div className="sports-meta">{activeGame.venue || sport} · {new Date(activeGame.startTime).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div>
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>MERCADO</span><h3>Momios y movimiento</h3></div>
          <div className="sports-consensus-grid">
            <div><small>{activeGame.away.abbreviation}</small><strong>{odd(activeGame.consensusAway)}</strong>{awayMove ? <span className={awayMove}>{awayMove === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}{awayMove === 'up' ? 'sube' : 'baja'}</span> : <span>sin cambio</span>}</div>
            <div><small>{activeGame.home.abbreviation}</small><strong>{odd(activeGame.consensusHome)}</strong>{homeMove ? <span className={homeMove}>{homeMove === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}{homeMove === 'up' ? 'sube' : 'baja'}</span> : <span>sin cambio</span>}</div>
          </div>
          {firstPoint && oddsHistory.length > 1 ? <div className="sports-opening-row">
            <span>PRIMER REGISTRO</span><b>{activeGame.away.abbreviation} {odd(firstPoint.away)}</b><b>{activeGame.home.abbreviation} {odd(firstPoint.home)}</b>
          </div> : null}
          {activeGame.books.length ? <div className="sports-books">
            <div className="sports-books-head"><span>CASA</span><b>{activeGame.away.abbreviation}</b><b>{activeGame.home.abbreviation}</b></div>
            {activeGame.books.map((book) => <div key={`${activeGame.id}-${book.provider}`}><span>{book.provider}</span><b>{odd(book.away)}</b><b>{odd(book.home)}</b></div>)}
          </div> : <div className="sports-empty">Buscando momios publicados por las casas…</div>}
          {recentHistory.length > 1 ? <div className="sports-odds-history">
            <div className="sports-mini-title">HISTORIAL EN ESTE DISPOSITIVO</div>
            {recentHistory.map((point, index) => <div key={`${point.at}-${index}`}><span>{new Date(point.at).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}</span><b>{odd(point.away)}</b><b>{odd(point.home)}</b></div>)}
          </div> : null}
          {liveError ? <div className="sports-empty compact">{liveError}</div> : null}
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>FORMA</span><h3>Últimos 5 / 10</h3></div>
          {contextLoading && !effectiveContext.form.away && !effectiveContext.form.home ? <div className="sports-empty">Actualizando forma reciente…</div> : null}
          <div className="sports-form-grid">
            <div>
              <small>{activeGame.away.abbreviation}</small><strong>{formRecord(effectiveContext.form.away, 5)} <em>L5</em></strong><b>{formRecord(effectiveContext.form.away, 10)} <em>L10</em></b>
              <div className="sports-form-sequence">{sequence(effectiveContext.form.away, 5).map((value, index) => <span className={value === 'W' ? 'win' : 'loss'} key={`${value}-${index}`}>{value}</span>)}</div>
            </div>
            <div>
              <small>{activeGame.home.abbreviation}</small><strong>{formRecord(effectiveContext.form.home, 5)} <em>L5</em></strong><b>{formRecord(effectiveContext.form.home, 10)} <em>L10</em></b>
              <div className="sports-form-sequence">{sequence(effectiveContext.form.home, 5).map((value, index) => <span className={value === 'W' ? 'win' : 'loss'} key={`${value}-${index}`}>{value}</span>)}</div>
            </div>
          </div>
          {contextError ? <div className="sports-empty compact">{contextError}</div> : null}
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>CONTEXTO</span><h3>Cómo llegan</h3></div>
          <div className="sports-context-grid">
            <div><small>{activeGame.away.abbreviation}</small><strong>{awayStanding ? `${awayStanding.wins}-${awayStanding.losses}` : '—'}</strong><span>{awayStanding ? `${awayStanding.pct} · #${awayStanding.rank}` : 'Sin tabla disponible'}</span></div>
            <div><small>{activeGame.home.abbreviation}</small><strong>{homeStanding ? `${homeStanding.wins}-${homeStanding.losses}` : '—'}</strong><span>{homeStanding ? `${homeStanding.pct} · #${homeStanding.rank}` : 'Sin tabla disponible'}</span></div>
          </div>
        </section>

        {sport === 'MLB' ? <section className="sports-card">
          <div className="sports-card-title"><span>ABRIDORES</span><h3>Pitchers probables</h3></div>
          <div className="sports-pitcher-grid">
            <div><small>{activeGame.away.abbreviation}</small><strong>{effectiveContext.probablePitchers?.away || 'Por confirmar'}</strong></div>
            <div><small>{activeGame.home.abbreviation}</small><strong>{effectiveContext.probablePitchers?.home || 'Por confirmar'}</strong></div>
          </div>
        </section> : null}

        <section className="sports-card">
          <div className="sports-card-title"><span>DISPONIBILIDAD</span><h3>Lesiones reportadas</h3></div>
          <div className="sports-injury-grid">
            <div><small>{activeGame.away.abbreviation}</small>{effectiveContext.injuries.away.length ? effectiveContext.injuries.away.slice(0, 5).map((item) => <div className="sports-injury" key={`${activeGame.away.abbreviation}-${item.name}`}><strong>{item.name}</strong><span>{item.status}{item.detail ? ` · ${item.detail}` : ''}</span></div>) : <span className="sports-none">Sin reporte disponible.</span>}</div>
            <div><small>{activeGame.home.abbreviation}</small>{effectiveContext.injuries.home.length ? effectiveContext.injuries.home.slice(0, 5).map((item) => <div className="sports-injury" key={`${activeGame.home.abbreviation}-${item.name}`}><strong>{item.name}</strong><span>{item.status}{item.detail ? ` · ${item.detail}` : ''}</span></div>) : <span className="sports-none">Sin reporte disponible.</span>}</div>
          </div>
        </section>

        <section className="sports-card">
          <div className="sports-card-title"><span>{sport === 'MLB' ? 'LINEUP' : 'STARTERS'}</span><h3>{effectiveContext.lineups.status === 'published' ? 'Publicados' : 'Aún no publicados'}</h3></div>
          {effectiveContext.lineups.status === 'published' ? <div className="sports-lineup-grid">
            <div><small>{activeGame.away.abbreviation}</small>{effectiveContext.lineups.away.map((name, index) => <span key={`${activeGame.away.abbreviation}-${name}`}>{index + 1}. {name}</span>)}</div>
            <div><small>{activeGame.home.abbreviation}</small>{effectiveContext.lineups.home.map((name, index) => <span key={`${activeGame.home.abbreviation}-${name}`}>{index + 1}. {name}</span>)}</div>
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
