import { useEffect } from 'react';

/** MLB/NBA share an identical three-minute refresh lifecycle, not their request/cache rules. */
export function useSportsAutoRefresh(load: (refresh: boolean) => Promise<unknown> | void): void {
  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(false), 3 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);
}
