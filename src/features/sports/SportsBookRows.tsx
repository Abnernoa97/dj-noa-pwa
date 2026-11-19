import { favoriteFromOdds, odd } from './sportsPresentation';

type BookOdds = { provider: string; away: number; home: number };
type Props = { gameId: string; books: BookOdds[] };

/** Shared five-provider odds rows. Keeps the existing MLB/NBA CSS selectors and keys. */
export default function SportsBookRows({ gameId, books }: Props) {
  return <>{books.slice(0, 5).map((book) => {
    const bookFavorite = favoriteFromOdds(book.away, book.home);
    return <div key={`${gameId}-${book.provider}`}><span>{book.provider}</span><b className={bookFavorite === 'away' ? 'is-favorite' : ''}>{odd(book.away)}</b><b className={bookFavorite === 'home' ? 'is-favorite' : ''}>{odd(book.home)}</b></div>;
  })}</>;
}
