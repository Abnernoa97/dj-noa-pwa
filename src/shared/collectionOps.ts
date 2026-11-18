/** Immutable Set toggling shared by event accordion, event selection, and Excel row selection. */
export function toggleSetMember<T>(current: ReadonlySet<T>, id: T): Set<T> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Idempotent immutable Set insertion for long-press row selection. */
export function addSetMember<T>(current: ReadonlySet<T>, id: T): Set<T> {
  const next = new Set(current);
  next.add(id);
  return next;
}
