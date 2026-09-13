import { describe, expect, it, vi, beforeEach } from 'vitest';

/* Every other test that touches the change log mocks `repo.js` wholesale (see
   `routes/library.test.ts`), so `appendChangeLog` itself had never been exercised against
   anything resembling a database. It was inserting `newId('log')` into `changelog.id`, which is
   `uuid primary key default gen_random_uuid()` — so in production every Content Admin mutation
   threw `invalid input syntax for type uuid: "log-2mks435g"` at its audit step, while 35 route
   tests passed. These assert the insert payload directly, which is the only level at which the
   mismatch is visible without a live Postgres. */

// vi.hoisted, because vi.mock is lifted above plain top-level consts.
const { insert, from } = vi.hoisted(() => {
  const insert = vi.fn();
  return { insert, from: vi.fn(() => ({ insert })) };
});

vi.mock('./supabase.js', () => ({ supabaseAdmin: { from } }));
vi.mock('./pgPool.js', () => ({ pgPool: {} }));

import { appendChangeLog } from './repo.js';

const ENTRY = {
  Who: 'Mike',
  Action: 'reset' as const,
  Collection: 'library',
  ObjectId: 'library',
  ObjectName: 'Whole library',
  Before: null,
  After: { note: 'reset to seed' },
};

describe('appendChangeLog', () => {
  beforeEach(() => {
    insert.mockReset();
    from.mockClear();
    insert.mockResolvedValue({ error: null });
  });

  it('omits id entirely, so the uuid column default supplies one', async () => {
    await appendChangeLog(ENTRY);

    expect(from).toHaveBeenCalledWith('changelog');
    expect(insert).toHaveBeenCalledTimes(1);
    const payload = insert.mock.calls[0][0];
    // The regression in one line: any own `id` key here is rejected by Postgres, because
    // nothing this app generates is a uuid.
    expect(Object.prototype.hasOwnProperty.call(payload, 'id')).toBe(false);
  });

  it('sends exactly the columns changelog declares, and nothing else', async () => {
    await appendChangeLog(ENTRY);

    expect(Object.keys(insert.mock.calls[0][0]).sort()).toEqual(
      ['action', 'after', 'at', 'before', 'collection', 'object_id', 'object_name', 'who'],
    );
  });

  it('maps the entry onto its snake_case columns', async () => {
    await appendChangeLog(ENTRY);

    const payload = insert.mock.calls[0][0];
    expect(payload.who).toBe('Mike');
    expect(payload.action).toBe('reset');
    expect(payload.collection).toBe('library');
    expect(payload.object_id).toBe('library');
    expect(payload.object_name).toBe('Whole library');
    expect(payload.before).toBeNull();
    expect(payload.after).toEqual({ note: 'reset to seed' });
    expect(typeof payload.at).toBe('string');
  });

  it('throws when the insert is rejected, rather than losing the audit entry silently', async () => {
    insert.mockResolvedValue({ error: { message: 'invalid input syntax for type uuid' } });

    await expect(appendChangeLog(ENTRY)).rejects.toBeTruthy();
  });
});
