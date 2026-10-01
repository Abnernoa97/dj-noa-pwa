import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHardRockPublishedMarket, type HardRockPublishedMarket } from './hardRockOdds';

type MarketState = {
  host: HTMLElement;
  card: HTMLElement;
  market: HardRockPublishedMarket;
  away: string;
  home: string;
};

function odd(value: number) {
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;
}

function line(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function publishedLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Publicado por Hard Rock Bet';
  return `Publicado ${date.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

function currentMarketFor(sport: 'MLB' | 'NBA', away: string, home: string) {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return getHardRockPublishedMarket(sport, localDate, away, home);
}

export default function HardRockMarketEnhancer() {
  const [state, setState] = useState<MarketState | null>(null);

  useEffect(() => {
    let currentCard: HTMLElement | null = null;
    let currentHost: HTMLElement | null = null;

    const clear = () => {
      currentCard?.classList.remove('hard-rock-market-active');
      currentHost?.remove();
      currentCard = null;
      currentHost = null;
      setState(null);
    };

    const sync = () => {
      const detail = document.querySelector<HTMLElement>('.sports-detail');
      if (!detail) {
        if (currentCard) clear();
        return;
      }

      const sport: 'MLB' | 'NBA' = detail.classList.contains('nba') ? 'NBA' : 'MLB';
      const matchup = detail.querySelector<HTMLElement>('.sports-detail-head h2')?.textContent || '';
      const match = matchup.match(/^\s*([A-Z0-9]+)\s+vs\s+([A-Z0-9]+)\s*$/i);
      if (!match) {
        if (currentCard) clear();
        return;
      }

      const away = match[1].toUpperCase();
      const home = match[2].toUpperCase();
      const market = currentMarketFor(sport, away, home);
      if (!market) {
        if (currentCard) clear();
        return;
      }

      const cards = Array.from(detail.querySelectorAll<HTMLElement>('.sports-card'));
      const card = cards.find((item) => item.querySelector('h3')?.textContent?.trim() === 'Momios y movimiento') || null;
      if (!card) return;

      if (card === currentCard && currentHost?.isConnected) {
        setState((existing) => existing && existing.market === market ? existing : { host: currentHost!, card, market, away, home });
        return;
      }

      clear();
      const host = document.createElement('div');
      host.className = 'hard-rock-market-mount';
      const title = card.querySelector('.sports-card-title');
      if (title?.nextSibling) card.insertBefore(host, title.nextSibling);
      else card.appendChild(host);
      card.classList.add('hard-rock-market-active');
      currentCard = card;
      currentHost = host;
      setState({ host, card, market, away, home });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      clear();
    };
  }, []);

  if (!state) return null;
  const { host, market, away, home } = state;

  return createPortal(
    <div className="hard-rock-market" aria-label="Momios oficiales publicados por Hard Rock Bet">
      <div className="hard-rock-source-row">
        <span className="hard-rock-source-pill">HARD ROCK BET</span>
        <small>REFERENCIA OFICIAL PUBLICADA</small>
      </div>

      <div className="hard-rock-moneyline">
        <div><small>{away}</small><strong>{odd(market.moneyline.away)}</strong><span>MONEYLINE</span></div>
        <div><small>{home}</small><strong>{odd(market.moneyline.home)}</strong><span>MONEYLINE</span></div>
      </div>

      <div className="hard-rock-board">
        {market.runLine ? <div className="hard-rock-row">
          <span>RUN LINE</span>
          <b>{away} {line(market.runLine.away.line)} <em>{odd(market.runLine.away.odds)}</em></b>
          <b>{home} {line(market.runLine.home.line)} <em>{odd(market.runLine.home.odds)}</em></b>
        </div> : null}
        {market.total ? <div className="hard-rock-row">
          <span>TOTAL {market.total.line}</span>
          <b>OVER <em>{odd(market.total.over)}</em></b>
          <b>UNDER <em>{odd(market.total.under)}</em></b>
        </div> : null}
      </div>

      <div className="hard-rock-market-note">
        <strong>{publishedLabel(market.publishedAt)}</strong>
        <span>Los momios pueden cambiar. Esta tarjeta muestra la línea publicada por Hard Rock Bet, no un feed en vivo.</span>
      </div>
    </div>,
    host
  );
}
