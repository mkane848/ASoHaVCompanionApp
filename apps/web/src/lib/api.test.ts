import { describe, expect, expectTypeOf, it, vi, beforeEach, afterEach } from 'vitest';

// request<T>() isn't exported directly — every api.* method is a thin wrapper around it, so
// exercising it through a couple of real call sites covers the same behavior without widening
// the module's surface (TechStackAudit.md D9: "request<T>()'s error mapping... against a
// stubbed fetch. Genuinely untested and genuinely user-facing.").
vi.mock('./supabaseClient.js', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

import { STANDARD_VIRTUE_ARRAYS, characterCreationSchema, seedLibrary, type CharacterCreationInput, type Party } from '@asohav/shared';
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

// A deploy restarts the server, and a save landing in that window is answered by Render's proxy
// rather than the app (a production Party save hit exactly this). Fake timers stand in for the
// retry's delay; an implementation that retried where it shouldn't would wait on a timer nobody
// advances and fail by timeout rather than pass by accident.
describe('request() retry across a server restart', () => {
  const party = { Motif: 'The Wardens' } as Party;
  const restarting = () => new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a PUT once after a 502 and resolves with the second attempt', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(restarting())
      .mockResolvedValueOnce(new Response(JSON.stringify({ party }), { status: 200 }));

    const pending = api.party.save('cm-1', party);
    await vi.advanceTimersByTimeAsync(1_500);

    await expect(pending).resolves.toEqual({ party });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries a PUT once after a network failure (not only a proxy status)', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ party }), { status: 200 }));

    const pending = api.party.save('cm-1', party);
    await vi.advanceTimersByTimeAsync(1_500);

    await expect(pending).resolves.toEqual({ party });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after a second 502 with a message the player can act on, not "Bad Gateway"', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(restarting()).mockResolvedValueOnce(restarting());

    // Attached before the timers run, so the rejection is never momentarily unhandled.
    const assertion = expect(api.party.save('cm-1', party)).rejects.toMatchObject(
      new ApiError(502, 'The server was restarting — try again in a moment.'),
    );
    await vi.advanceTimersByTimeAsync(1_500);

    await assertion;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('never retries a POST — a Bond action that did land would happen twice', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(restarting());

    await expect(api.bond.accept('cm-1', 'bd-1')).rejects.toMatchObject(
      new ApiError(502, 'The server was restarting — try again in a moment.'),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never retries a 4xx — the server answered, and the same body would be refused again', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'This campaign is archived.' }), { status: 409 }));

    await expect(api.party.save('cm-1', party)).rejects.toMatchObject(new ApiError(409, 'This campaign is archived.'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('api.character.create', () => {
  // A compile-time check: expectTypeOf is a no-op under `vitest run`, and it is
  // `npm run typecheck -w @asohav/web` (CI's build job; tsconfig includes src/**, tests too) that
  // fails if this drifts. The round-trip test below can't catch a hand-written body type coming
  // back: request() serializes whatever object it's given, so a full form still goes out whole,
  // while the page's onSubmit could again drop fields and compile.
  it("types its body as the shared schema's CharacterCreationInput", () => {
    expectTypeOf<Parameters<typeof api.character.create>[1]>().toEqualTypeOf<CharacterCreationInput>();
  });

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

// GM-authored Villains/NPCs (0.67.0): the paths and verbs are a contract with apps/server's
// /gm-content router, and a typo here would only surface as a 404 in the browser.
describe('api.gmContent', () => {
  it('lists, creates, updates and deletes against /api/gm-content with the pinned verbs and bodies', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ villains: [], npcs: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ entry: { Id: 'gvil-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ entry: { Id: 'gvil-1' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await api.gmContent.list();
    await api.gmContent.create({ kind: 'villain', scope: 'Mine', data: { Name: 'Grizza' } });
    await api.gmContent.update('gvil-1', { scope: 'SiteWide', data: { Goal: 'Win.' } });
    await expect(api.gmContent.remove('gvil-1')).resolves.toBeUndefined();

    const calls = vi.mocked(fetch).mock.calls.map(([url, init]) => [url, init?.method ?? 'GET', init?.body]);
    expect(calls).toEqual([
      ['/api/gm-content', 'GET', undefined],
      ['/api/gm-content', 'POST', JSON.stringify({ kind: 'villain', scope: 'Mine', data: { Name: 'Grizza' } })],
      ['/api/gm-content/gvil-1', 'PUT', JSON.stringify({ scope: 'SiteWide', data: { Goal: 'Win.' } })],
      ['/api/gm-content/gvil-1', 'DELETE', undefined],
    ]);
  });

  it('rejects with the server\'s own validation message, which the form shows inline', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: '"Name" is required.' }), { status: 400, statusText: 'Bad Request' }));

    await expect(api.gmContent.create({ kind: 'npc', scope: 'Mine', data: {} })).rejects.toMatchObject(new ApiError(400, '"Name" is required.'));
  });
});
