import { createClient, isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — see apps/server/.env.example.');
}

// Service-role client: bypasses RLS entirely. Authorization is enforced here in the Express
// route handlers (membership checks, GM-only actions, admin-only library writes) rather than
// in RLS policies — see the design note at the top of supabase/migrations/20260802163411_init.sql.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface AuthUser {
  id: string;
  email: string;
}

/** Verifies a Supabase Auth access token (the JWT the browser sends as a Bearer token, or as
 *  a WebSocket query param) and returns the underlying Supabase Auth identity. */
export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  // Auth being unreachable is not the same as the token being bad. Until 0.86.0 both answered null,
  // so during a Supabase outage every request was a 401 and clients looked signed out; now an outage
  // is thrown as a 503 (docs/Audit-2026-11-12.md finding 11). Any other error keeps the old answer.
  if (error && (isAuthRetryableFetchError(error) || (isAuthApiError(error) && error.status >= 500))) {
    throw new AuthUnavailableError();
  }
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
}

/** The token could not be checked because Supabase did not answer. `status` is read by
 *  errorMiddleware. */
export class AuthUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super('Sign-in could not be checked just now. Try again in a moment.');
  }
}

