import { describe, expect, it, vi, beforeEach } from 'vitest';
import { seedSheets } from '@asohav/shared';

/* Every route test mocks `repo.js` wholesale, so `getSheet`'s self-heal had never run under test.
   It compared sixteen fields by reference, and `normalizeSheet` builds `Statuses` with `.filter()`,
   which returns a new array every time: the check was always true, so every sheet read wrote the
   sheet back. Each write emitted a Realtime event that made every open client refetch and write
   again, and a read racing a player's save could put the older copy back. Found by the 2026-11-12
   audit; these assert the read path against a stubbed Supabase client. */

const { upsert, maybeSingle, eq, from } = vi.hoisted(() => {
  const upsert = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn();
  const from = vi.fn(() => ({ upsert, select: vi.fn(() => ({ eq })) }));
  return { upsert, maybeSingle, eq, from };
});

vi.mock('./supabase.js', () => ({ supabaseAdmin: { from } }));
vi.mock('./pgPool.js', () => ({ pgPool: {} }));

import { escapeLike, getSheet, listSheetsForCampaign } from './repo.js';

// A sheet exactly as the server would have stored it: through JSON, so no shared references.
const stored = () => JSON.parse(JSON.stringify(seedSheets()[0]));

beforeEach(() => {
  upsert.mockReset();
  maybeSingle.mockReset();
  eq.mockReset();
  upsert.mockResolvedValue({ error: null });
});

describe('getSheet self-heal', () => {
  it('does not write back a sheet that is already normal', async () => {
    const first = stored();
    eq.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: { data: first, campaign_id: 'cm-1' }, error: null });
    // Heal once if the seed sheet itself predates a field, then read what was saved.
    await getSheet(first.CharacterId);
    const settled = upsert.mock.calls.length ? JSON.parse(JSON.stringify(upsert.mock.calls[0][0].data)) : first;
    upsert.mockClear();
    maybeSingle.mockResolvedValue({ data: { data: settled, campaign_id: 'cm-1' }, error: null });

    await getSheet(first.CharacterId);

    expect(upsert).not.toHaveBeenCalled();
  });

  it('still heals a sheet missing a field added after it was saved', async () => {
    const old = stored();
    delete old.Scars;
    eq.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: { data: old, campaign_id: 'cm-1' }, error: null });

    const sheet = await getSheet(old.CharacterId);

    expect(sheet?.Scars).toEqual([]);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('listSheetsForCampaign does not write back normal sheets either', async () => {
    const first = stored();
    eq.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: { data: first, campaign_id: 'cm-1' }, error: null });
    await getSheet(first.CharacterId);
    const settled = upsert.mock.calls.length ? JSON.parse(JSON.stringify(upsert.mock.calls[0][0].data)) : first;
    upsert.mockClear();
    eq.mockResolvedValue({ data: [{ data: settled, campaign_id: 'cm-1' }], error: null });

    await listSheetsForCampaign('cm-1');

    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('escapeLike', () => {
  it('escapes the LIKE wildcards so ilike is an equality match', () => {
    expect(escapeLike('a_b%c@x.com')).toBe('a\\_b\\%c@x.com');
    expect(escapeLike('plain@x.com')).toBe('plain@x.com');
  });
});
