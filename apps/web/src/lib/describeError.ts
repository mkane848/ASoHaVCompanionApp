/** The message to show for a failed call: the error's own when it has one, else `fallback`.
 *  In a module of its own so saveQueue.ts can use it without importing mutations.ts. */
export function describeError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
