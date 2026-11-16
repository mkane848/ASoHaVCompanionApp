import type { NextFunction, Request, Response } from 'express';

/** The response headers that cost nothing and that this app had none of (docs/Audit-2026-11-12.md
 *  finding 11): no MIME sniffing, no framing by another site, no full URL in the Referer sent to
 *  other origins, and HTTPS-only in production (Render terminates TLS in front of this process).
 *
 *  Deliberately no Content-Security-Policy. index.html carries an inline appearance script, the
 *  app sets inline styles, and it talks to Supabase over HTTPS and WebSocket; a policy that gets
 *  any of those wrong blanks the page, and it cannot be tested against the live site from the
 *  sandboxes this project is developed in. It is recorded as open, not forgotten. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
}
