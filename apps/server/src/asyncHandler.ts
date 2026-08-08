import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 (unlike 5) does not forward a rejected promise from an async route handler to the
 *  error-handling middleware — it becomes an unhandled rejection, which Node's default
 *  `--unhandled-rejections=throw` turns into a process crash. Every route handler in this app is
 *  async and calls into repo.ts functions that throw on any Supabase error, so without this
 *  wrapper a single transient Supabase hiccup on any endpoint takes the whole server down. Wrap
 *  every handler passed to a Router method with this so a thrown/rejected error becomes
 *  `next(err)` instead — index.ts's error-handling middleware turns that into a clean 500. */
export function wrap<P = any>(
  handler: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler<P> {
  return (req, res, next) => {
    handler(req as Request<P>, res, next).catch(next);
  };
}
