/** Runs a cleanup step after a failed multi-write route and logs, rather than throws, if the
 *  cleanup itself fails, so the caller can still report the original failure. */
export async function bestEffort(label: string, step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (err) {
    console.error(`[cleanup] ${label}`, err);
  }
}
