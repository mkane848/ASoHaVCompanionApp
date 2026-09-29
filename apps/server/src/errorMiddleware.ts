import type { NextFunction, Request, Response } from 'express';

/** The app's single error-handling middleware. Anything a route throws — including the
 *  `status`-carrying errors (`CampaignArchivedError` and its phase-gate siblings,
 *  `LibraryConflictError`) — arrives here via `wrap()`'s `next(err)` and becomes a JSON response
 *  with that status, or a 500.
 *
 *  Anything but a 4xx logs the error itself, stack included. A thrown 4xx is an expected refusal
 *  whose message is the whole story, and requestLog.ts already writes one line for every /api
 *  response at 400 or above, message included — logging it here too put a stack trace beside
 *  every 409.
 *
 *  Exported rather than inlined in index.ts so route tests can mount the real thing. A route that
 *  lets an error reach middleware instead of catching it inline depends on this for both its
 *  status code and its body shape, and a hand-copied stand-in in each test file would be free to
 *  drift from what production actually does. Express identifies an error handler by arity, so all
 *  four parameters have to stay even though `next` is unused. */
export function errorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction) {
  void next;
  const e = err as { status?: number; message?: string; type?: string } | null;
  const status = e?.status || 500;
  if (status < 400 || status >= 500) console.error(err);
  // express.json's parse failure carries V8's SyntaxError message, which quotes the offending
  // request body back — never echo that to the client or, through requestLog.ts, into the log.
  const message = e?.type === 'entity.parse.failed' ? 'Request body is not valid JSON.' : e?.message || 'Internal error.';
  res.status(status).json({ error: message });
}
