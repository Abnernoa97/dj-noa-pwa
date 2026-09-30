import { useEffect, useMemo, useState } from 'react';
import SportsGameDetail from './SportsGameDetail';

type BookOdds = { provider: string; away: number; home: number };
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
type Standing = {
  conference?: string;
  league?: string;
  division?: string;
  team: string;
  abbreviation: string;
  wins: number;
  losses: number;
  pct: string;
  gamesBack: string;
  rank: number;
};
type Snapshot = {
  date: string;
  nextDate?: string;
  games?: Game[];
  nextGames?: Game[];
  standings?: Standing[];
};

type Selection = { sport: 'MLB' | 'NBA'; game: Game; standings: Standing[] };

const MLB_CACHE_KEY = 'dj-noa-mlb-snapshot-v3';
const NBA_CACHE_KEY = 'dj-noa-nba-snapshot-v1';

function readSnapshot(key: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as Snapshot : null;
  } catch {
    return null;
  }
}

function timeValue(game: Game) {
  const value = new Date(game.startTime).getTime();
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function displayedGames(snapshot: Snapshot | null) {
  if (!snapshot) return [];
  const today = (snapshot.games || [])
    .filter((game) => game.status !== 'final')
    .sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'live') return -1;
        if (b.status === 'live') return 1;
      }
      return timeValue(a) - timeValue(b);
    });
  if (today.length) return today;
  return (snapshot.nextGames || []).filter((game) => game.status !== 'final').sort((a, b) => timeValue(a) - timeValue(b));
}

export default function SportsEnhancer() {
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (selection) return;
      const target = event.target as HTMLElement | null;
      const card = target?.closest('.mlb-game-card') as HTMLElement | null;
      if (!card) return;
      const workspace = card.closest('.mlb-workspace') as HTMLElement | null;
      if (!workspace) return;

      const sport: 'MLB' | 'NBA' = workspace.classList.contains('nba-workspace') ? 'NBA' : 'MLB';
      const cards = Array.from(workspace.querySelectorAll('.mlb-games-list > .mlb-game-card'));
      const index = cards.indexOf(card);
      if (index < 0) return;

      const snapshot = readSnapshot(sport === 'NBA' ? NBA_CACHE_KEY : MLB_CACHE_KEY);
      const games = displayedGames(snapshot);
      const game = games[index];
      if (!game) return;

      event.preventDefault();
      setSelection({ sport, game, standings: snapshot?.standings || [] });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [selection]);

  const detail = useMemo(() => selection ? (
    <SportsGameDetail
      sport={selection.sport}
      game={selection.game}
      standings={selection.standings}
      onBack={() => setSelection(null)}
    />
  ) : null, [selection]);

  return detail;
}
