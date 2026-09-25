import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// request<T>() isn't exported directly — every api.* method is a thin wrapper around it, so
// exercising it through a couple of real call sites covers the same behavior without widening
// the module's surface (TechStackAudit.md D9: "request<T>()'s error mapping... against a
// stubbed fetch. Genuinely untested and genuinely user-facing.").
vi.mock('./supabaseClient.js', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

import { STANDARD_VIRTUE_ARRAYS, characterCreationSchema, seedLibrary } from '@asohav/shared';
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

describe('api.character.create', () => {
  // From 0.55.0 to 0.64.2 the create-character page sent a hand-picked six of the schema's eight
  // fields, so the server rejected every web-created character. This pins the round trip: the
  // form's parsed output (what zodResolver hands onSubmit) goes out as a body the server's own
  // copy of the schema accepts.
  it('sends a body the server-side creation schema accepts, Improvements and Load included', async () => {
    const library = seedLibrary();
    const schema = characterCreationSchema(library);
    const [first, second] = library.improvements.filter((imp) => imp.IsStarting);
    const formData = schema.parse({
      name: 'Wren',
      pronouns: 'she/her',
      playerName: 'Mike',
      virtues: library.virtues.map((v, i) => ({ virtueId: v.Id, score: STANDARD_VIRTUE_ARRAYS[0]![i]! })),
      looks: ['A scar above one eye.'],
      motifs: [0, 1, 2].map((i) => ({ motifId: library.motifs[i]!.Id, name: library.motifs[i]!.Name, skillTag: 'Tracker', flawTag: 'Exiled', quest: 'Prove I belong' })),
      improvementIds: [first!.Id, second!.Id],
      loadTier: 'Heavy',
    });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));

    await api.character.create('cm-1', formData);

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('/campaigns/cm-1/characters');
    const sent = JSON.parse(init!.body as string);
    expect(schema.safeParse(sent).success).toBe(true);
    expect(sent).toMatchObject({ improvementIds: [first!.Id, second!.Id], loadTier: 'Heavy' });
  });
});
