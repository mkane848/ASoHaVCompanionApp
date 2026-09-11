import type { NextFunction, Request, Response } from 'express';

/** The app's single error-handling middleware. Anything a route throws — including the
 *  `status`-carrying errors (`CampaignArchivedError` and its phase-gate siblings,
 *  `LibraryConflictError`) — arrives here via `wrap()`'s `next(err)` and becomes a JSON response
 *  with that status, or a 500.
 *
 *  Exported rather than inlined in index.ts so route tests can mount the real thing. A route that
 *  lets an error reach middleware instead of catching it inline depends on this for both its
 *  status code and its body shape, and a hand-copied stand-in in each test file would be free to
 *  drift from what production actually does. Express identifies an error handler by arity, so all
 *  four parameters have to stay even though `next` is unused. */
export function errorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction) {
  void next;
  const e = err as { status?: number; message?: string } | null;
  console.error(err);
  res.status(e?.status || 500).json({ error: e?.message || 'Internal error.' });
}
