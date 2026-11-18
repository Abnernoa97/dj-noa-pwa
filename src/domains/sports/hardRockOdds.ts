export type HardRockPublishedMarket = {
  sport: 'MLB' | 'NBA';
  date: string;
  away: string;
  home: string;
  source: 'Hard Rock Bet';
  publishedAt: string;
  sourceUrl: string;
  moneyline: { away: number; home: number };
  runLine?: {
    away: { line: number; odds: number };
    home: { line: number; odds: number };
  };
  total?: { line: number; over: number; under: number };
};

const publishedMarkets: HardRockPublishedMarket[] = [
  {
    sport: 'MLB',
    date: '2026-10-01',
    away: 'PHI',
    home: 'ATL',
    source: 'Hard Rock Bet',
    publishedAt: '2026-10-01T16:30:00-04:00',
    sourceUrl: 'https://www.hardrock.bet/news/phillies-vs-braves-best-player-props-predictions-odds-for-nl-wild-card-game-3/',
    moneyline: { away: -110, home: -110 },
    runLine: {
      away: { line: -1.5, odds: 150 },
      home: { line: 1.5, odds: -190 }
    },
    total: { line: 7.5, over: -105, under: -115 }
  }
];

function normalize(value: string) {
  return value.trim().toUpperCase();
}

export function getHardRockPublishedMarket(
  sport: 'MLB' | 'NBA',
  date: string,
  away: string,
  home: string
) {
  const awayKey = normalize(away);
  const homeKey = normalize(home);
  return publishedMarkets.find((market) =>
    market.sport === sport
    && market.date === date
    && market.away === awayKey
    && market.home === homeKey
  ) || null;
}
