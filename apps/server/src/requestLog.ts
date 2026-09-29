import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';

/** Writes one line per /api response at 400 or above:
 *
 *    [api] PUT /api/campaigns/cm-1/party -> 409 user=<id> 14ms "This campaign is archived."
 *
 *  Render keeps no request log on this plan, and before this most 4xx responses left no
 *  server-side trace at all — a route answering `res.status(409).json(...)` inline never reaches
 *  errorMiddleware, the only other place anything is logged. A player's red error toast then
 *  couldn't be told apart, after the fact, from a request lost in a deploy's restart window.
 *  A 2xx logs nothing.
 *
 *  Deliberately narrow in what it records: the method, the path with any query string cut off,
 *  the status, the user id, the duration, and the `error` string from the JSON body the route
 *  itself sent back. Never the request body, headers or token. The message is JSON-quoted so a
 *  newline in it can't split the entry across lines.
 *
 *  `req.user` is read at 'finish', not up front: index.ts mounts this ahead of attachUser (and of
 *  express.json, so a malformed or oversized body's 400/413 is logged too). */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const started = performance.now();
  let message: string | null = null;

  // The only place the error message is visible — 'finish' carries no body. Captured only for an
  // error status, so a 2xx body is never even inspected.
  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (res.statusCode >= 400) {
      const error = (body as { error?: unknown } | null | undefined)?.error;
      if (typeof error === 'string') message = error;
    }
    return json(body);
  };

  res.on('finish', () => {
    const status = res.statusCode;
    if (status < 400) return;
    const path = req.originalUrl.split('?')[0];
    const ms = Math.round(performance.now() - started);
    const line = `[api] ${req.method} ${path} -> ${status} user=${req.user?.id ?? '-'} ${ms}ms${message === null ? '' : ` ${JSON.stringify(message)}`}`;
    if (status >= 500) console.error(line);
    else console.warn(line);
  });

  next();
}
