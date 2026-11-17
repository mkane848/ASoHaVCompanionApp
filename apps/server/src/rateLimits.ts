import type { Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

/** Request limits (docs/Audit-2026-11-12.md findings 4 and 11). Before 0.84.0 nothing bounded how
 *  fast one account could call the API, and two routes have a cost outside this app: sending an
 *  invite mails someone (and through Supabase's leg creates an auth user), and creating a campaign
 *  writes four rows. Those get tight limits; everything else under /api gets a loose one that an
 *  open campaign page, with its live refetches, stays far below.
 *
 *  Keyed by user id once `attachUser` has run, by IP otherwise, so players behind one home router
 *  do not share a budget. In memory: right for the single Render instance this runs as, and wrong
 *  the day it is scaled out to several, when it needs a shared store (docs/operations.md).
 *
 *  A refusal is a 429 with the `{ error }` body every route uses, so the client's existing toast
 *  shows the message and requestLog.ts records it. */

export interface RateLimitSettings {
  /** Per user (or IP) per 5 minutes, across /api. */
  general: number;
  /** Campaigns created, per user per hour. */
  campaigns: number;
  /** Invites sent or resent, per user per hour. */
  invites: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitSettings = { general: 600, campaigns: 10, invites: 20 };

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function keyFor(req: Request): string {
  return req.user ? `user:${req.user.id}` : `ip:${req.ip ?? 'unknown'}`;
}

function limiter(windowMs: number, limit: number, message: string, skip?: (req: Request) => boolean): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyFor,
    skip,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: message });
    },
  });
}

export function createRateLimits(settings: RateLimitSettings = DEFAULT_RATE_LIMITS) {
  return {
    /** Mount at /api, after attachUser. The health routes are skipped: Render polls /api/health. */
    general: limiter(FIVE_MINUTES, settings.general, 'Too many requests. Wait a minute and try again.', (req) => req.path.startsWith('/health')),
    campaigns: limiter(ONE_HOUR, settings.campaigns, 'You have created a lot of campaigns in the last hour. Try again later.'),
    invites: limiter(ONE_HOUR, settings.invites, 'You have sent a lot of invites in the last hour. Try again later.'),
  };
}
