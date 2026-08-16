import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// request<T>() isn't exported directly — every api.* method is a thin wrapper around it, so
// exercising it through a couple of real call sites covers the same behavior without widening
// the module's surface (TechStackAudit.md D9: "request<T>()'s error mapping... against a
// stubbed fetch. Genuinely untested and genuinely user-facing.").
vi.mock('./supabaseClient.js', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

import { api, ApiError } from './api.js';
import { supabase } from './supabaseClient.js';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request()', () => {
  it('resolves the parsed JSON body on a 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { Id: 'u-1' } }), { status: 200 }));

    const result = await api.auth.me();

    expect(result).toEqual({ user: { Id: 'u-1' } });
  });

  it('resolves undefined on a 204, without attempting to parse a body', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const result = await api.invites.decline('inv-1');

    expect(result).toBeUndefined();
  });

  it('rejects with ApiError(status, body.error) on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'No such campaign.' }), { status: 404, statusText: 'Not Found' }));

    await expect(api.auth.me()).rejects.toMatchObject(new ApiError(404, 'No such campaign.'));
  });

  it('falls back to statusText when a non-ok body has no error field (or is not JSON)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not json', { status: 500, statusText: 'Internal Server Error' }));

    await expect(api.auth.me()).rejects.toMatchObject(new ApiError(500, 'Internal Server Error'));
  });

  it('maps a TimeoutError abort to ApiError(0, ...) with a distinct message from a plain network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

    await expect(api.auth.me()).rejects.toMatchObject(new ApiError(0, 'That took too long to respond. Check your connection and try again.'));
  });

  it('maps any other fetch rejection to a generic unreachable-server ApiError(0, ...)', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.auth.me()).rejects.toMatchObject(new ApiError(0, 'Could not reach the server. Check your connection and try again.'));
  });

  it('attaches no Authorization header when there is no session', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await api.auth.me();

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect((init!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('attaches a Bearer header carrying the session access token when a session exists', async () => {
    // request() only ever reads session.access_token off this, so a minimal fixture (rather
    // than a fully-populated Session+User) is deliberate, not a shortcut around the type.
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-access-token' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await api.auth.me();

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer test-access-token');
  });
});
