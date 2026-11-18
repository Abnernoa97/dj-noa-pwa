import { rec, list, str, type AnyRecord } from './espnCore.ts';

/** Sports context and live share identical text normalization and lexical ISO-day extraction. */
export function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function dateOnly(value: string) { return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''; }


/** Original MLB batting order semantics; names in published order, maximum nine. */
export function playerName(value: unknown) {
  const item = rec(value);
  return str(item.fullName) || str(item.displayName) || str(item.name);
}

export function lineupFromBoxscoreSide(side: AnyRecord) {
  const players = rec(side.players);
  const order = list(side.battingOrder).map((value) => String(value));
  const names: string[] = [];
  for (const rawId of order) {
    const key = rawId.startsWith('ID') ? rawId : `ID${rawId}`;
    const player = rec(players[key]);
    const name = playerName(player.person);
    if (name) names.push(name);
  }
  return names.slice(0, 9);
}

