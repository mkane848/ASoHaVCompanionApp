import { describe, expect, it, vi, beforeEach } from 'vitest';

/* docs/Audit-2026-11-12.md finding 11: an Auth or database outage used to answer 401, so clients
   looked signed out. These drive verifyAccessToken and loadUser against a stubbed Supabase client. */

const fake = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { data: null as unknown, error: null as unknown },
}));

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const real = await importOriginal<typeof import('@supabase/supabase-js')>();
  return {
    ...real,
    createClient: () => ({
      auth: { getUser: fake.getUser },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(fake.profile) }) }) }),
    }),
  };
});

import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { AuthUnavailableError, verifyAccessToken } from './supabase.js';
import { loadUser } from './auth.js';

beforeEach(() => {
  fake.getUser.mockReset();
  fake.profile = { data: null, error: null };
});

describe('verifyAccessToken', () => {
  it('answers null for a token Auth rejects', async () => {
    fake.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('invalid JWT', 403, 'bad_jwt') });
    expect(await verifyAccessToken('t')).toBeNull();
  });

  it('throws a 503 when Auth cannot be reached', async () => {
    fake.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('fetch failed', 0) });
    await expect(verifyAccessToken('t')).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it('throws a 503 when Auth answers with a server error', async () => {
    fake.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('upstream', 502, 'unexpected_failure') });
    await expect(verifyAccessToken('t')).rejects.toMatchObject({ status: 503 });
  });
});

describe('loadUser', () => {
  it('throws a 503 when the profile cannot be read, rather than answering "no such user"', async () => {
    fake.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@x.test' } }, error: null });
    fake.profile = { data: null, error: { message: 'connection refused' } };
    await expect(loadUser('t')).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it('answers null when the account has no profile', async () => {
    fake.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@x.test' } }, error: null });
    expect(await loadUser('t')).toBeNull();
  });
});
