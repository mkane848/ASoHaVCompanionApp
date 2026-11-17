import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabaseClient.js', () => ({ supabase: { auth: { getSession: vi.fn() } } }));

import { ApiError } from './api.js';
import { DocumentSaveQueue, STALE_GIVE_UP_MESSAGE, sameContent } from './saveQueue.js';

// The stale-save queue behind useOptimisticCommit (0.84.0, docs/Audit-2026-11-12.md finding 7),
// driven against an in-memory "cache" and a hand-resolved save.

interface Doc { UpdatedAt: string; Rapport: number; Note: string }

const stale = () => new ApiError(409, 'Someone else changed this at the same time.', 'stale_document');

function setup(initial: Doc) {
  let shown: Doc | null = initial;
  const saves: { doc: Doc; expected: string | undefined; resolve: (d: Doc) => void; reject: (e: unknown) => void }[] = [];
  const notify = vi.fn();
  const fetchFresh = vi.fn<() => Promise<Doc | null>>();
  const q = new DocumentSaveQueue<Doc>({
    read: () => shown,
    write: (d) => { shown = d; },
    save: (doc, expected) => new Promise((resolve, reject) => saves.push({ doc, expected, resolve, reject })),
    fetchFresh,
    notify,
    errorMessage: 'Could not save.',
  });
  return { q, saves, notify, fetchFresh, shown: () => shown };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const plusOne = (d: Doc) => { d.Rapport += 1; };

describe('DocumentSaveQueue', () => {
  it('shows the edit at once and saves it with the UpdatedAt it started from', async () => {
    const t = setup({ UpdatedAt: 't0', Rapport: 1, Note: '' });
    const run = t.q.commit(plusOne);
    expect(t.shown()!.Rapport).toBe(2);
    expect(t.saves[0].expected).toBe('t0');
    t.saves[0].resolve({ ...t.saves[0].doc, UpdatedAt: 't1' });
    await run;
    expect(t.shown()!.UpdatedAt).toBe('t1');
  });

  it('holds edits made while a save is out and sends them together, on the returned UpdatedAt', async () => {
    const t = setup({ UpdatedAt: 't0', Rapport: 1, Note: '' });
    const run = t.q.commit(plusOne);
    t.q.commit(plusOne);
    t.q.commit((d) => { d.Note = 'x'; });
    expect(t.saves).toHaveLength(1);
    expect(t.shown()).toMatchObject({ Rapport: 3, Note: 'x' });

    t.saves[0].resolve({ ...t.saves[0].doc, UpdatedAt: 't1' });
    await tick();
    expect(t.saves).toHaveLength(2);
    expect(t.saves[1].expected).toBe('t1');
    expect(t.saves[1].doc).toMatchObject({ Rapport: 3, Note: 'x' });
    t.saves[1].resolve({ ...t.saves[1].doc, UpdatedAt: 't2' });
    await run;
    expect(t.q.busy).toBe(false);
  });

  it("reapplies a refused edit on the other writer's copy and resends it once", async () => {
    const t = setup({ UpdatedAt: 't0', Rapport: 1, Note: '' });
    const run = t.q.commit(plusOne);
    t.fetchFresh.mockResolvedValue({ UpdatedAt: 't5', Rapport: 4, Note: 'theirs' });
    t.saves[0].reject(stale());
    await tick();
    expect(t.saves).toHaveLength(2);
    expect(t.saves[1].expected).toBe('t5');
    expect(t.saves[1].doc).toMatchObject({ Rapport: 5, Note: 'theirs' });
    t.saves[1].resolve({ ...t.saves[1].doc, UpdatedAt: 't6' });
    await run;
    expect(t.shown()).toMatchObject({ Rapport: 5, Note: 'theirs', UpdatedAt: 't6' });
    expect(t.notify).not.toHaveBeenCalled();
  });

  it('does not apply an edit twice when its own save had landed and only the answer was lost', async () => {
    const t = setup({ UpdatedAt: 't0', Rapport: 1, Note: '' });
    const run = t.q.commit(plusOne);
    // The server holds exactly what was sent, under a newer stamp.
    t.fetchFresh.mockResolvedValue({ UpdatedAt: 't1', Rapport: 2, Note: '' });
    t.saves[0].reject(stale());
    await run;
    expect(t.saves).toHaveLength(1);
    expect(t.shown()).toMatchObject({ Rapport: 2, UpdatedAt: 't1' });
  });

  it('gives up after a second refusal, shows the server copy and says so', async () => {
    const t = setup({ UpdatedAt: 't0', Rapport: 1, Note: '' });
    const run = t.q.commit(plusOne);
    t.fetchFresh.mockResolvedValueOnce({ UpdatedAt: 't5', Rapport: 4, Note: '' }).mockResolvedValueOnce({ UpdatedAt: 't7', Rapport: 9, Note: '' });
    t.saves[0].reject(stale());
    await tick();
    t.saves[1].reject(stale());
    await run;
    expect(t.shown()).toMatchObject({ Rapport: 9, UpdatedAt: 't7' });
    expect(t.notify).toHaveBeenCalledWith(STALE_GIVE_UP_MESSAGE);
  });

  it('rolls back a failed save but keeps edits made after it', async () => {
    const t = setup({ UpdatedAt: 't0', Rapport: 1, Note: '' });
    const run = t.q.commit(plusOne);
    t.q.commit((d) => { d.Note = 'later'; });
    t.saves[0].reject(new ApiError(0, 'Could not reach the server.'));
    await tick();
    expect(t.notify).toHaveBeenCalledWith('Could not reach the server.');
    expect(t.shown()).toMatchObject({ Rapport: 1, Note: 'later' });
    expect(t.saves[1].expected).toBe('t0');
    t.saves[1].resolve({ ...t.saves[1].doc, UpdatedAt: 't1' });
    await run;
  });

  it('treats a 409 that is not a stale document as an ordinary failure', async () => {
    const t = setup({ UpdatedAt: 't0', Rapport: 1, Note: '' });
    const run = t.q.commit(plusOne);
    t.saves[0].reject(new ApiError(409, 'This campaign is archived.'));
    await run;
    expect(t.fetchFresh).not.toHaveBeenCalled();
    expect(t.notify).toHaveBeenCalledWith('This campaign is archived.');
    expect(t.shown()!.Rapport).toBe(1);
  });
});

describe('sameContent', () => {
  it('ignores the save stamps and key order', () => {
    expect(sameContent({ a: 1, b: { c: 2, d: 3 }, UpdatedAt: 'x', UpdatedBy: 'u1' }, { b: { d: 3, c: 2 }, a: 1, UpdatedAt: 'y' })).toBe(true);
    expect(sameContent({ a: 1 }, { a: 2 })).toBe(false);
  });
});
