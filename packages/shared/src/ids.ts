/** Ids and timestamps, in a module of their own so the rule modules (`engine.ts`, `enemies.ts`)
 *  can use them without importing `logic.ts`, which imports them back for `normalizeEncounter`.
 *  `logic.ts` re-exports both, so every existing import of them still works. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = 'x'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
