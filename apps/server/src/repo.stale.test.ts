import { describe, expect, it, vi, beforeEach } from 'vitest';

/* The stale-save precondition (0.84.0, docs/Audit-2026-11-12.md finding 7). Route tests mock
   repo.ts wholesale, so this is the only level at which the conditional write itself is checked:
   with a precondition the save is an UPDATE filtered on the stored document's UpdatedAt, and zero
   rows changed is a conflict; without one it is the unconditional upsert it always was. */

const calls = vi.hoisted(() => ({ eqs: [] as [string, unknown][], updateRows: [] as unknown[], upserts: [] as unknown[], result: { data: [] as unknown[], error: null as unknown } }));

vi.mock('./supabase.js', () => {
  const chain = {
    update: (row: unknown) => { calls.updateRows.push(row); return chain; },
    eq: (col: string, v: unknown) => { calls.eqs.push([col, v]); return chain; },
    select: () => Promise.resolve(calls.result),
    upsert: (row: unknown) => { calls.upserts.push(row); return Promise.resolve({ error: null }); },
  };
  return { supabaseAdmin: { from: () => chain } };
});
vi.mock('./pgPool.js', () => ({ pgPool: {} }));

import { saveParty, saveSheet } from './repo.js';
import { StaleDocumentError } from './staleDocument.js';
import type { CharacterSheet, Party } from '@asohav/shared';

const party = () => ({ Id: 'pt-1', CampaignId: 'cm-1', UpdatedAt: 'old' }) as unknown as Party;

beforeEach(() => {
  calls.eqs = [];
  calls.updateRows = [];
  calls.upserts = [];
  calls.result = { data: [], error: null };
});

describe('stale-save precondition', () => {
  it('writes conditionally on the stored UpdatedAt and succeeds when a row matched', async () => {
    calls.result = { data: [{ campaign_id: 'cm-1' }], error: null };
    await saveParty(party(), '2026-11-17T10:00:00.000Z');
    expect(calls.upserts).toHaveLength(0);
    expect(calls.eqs).toContainEqual(['campaign_id', 'cm-1']);
    expect(calls.eqs).toContainEqual(['data->>UpdatedAt', '2026-11-17T10:00:00.000Z']);
  });

  it('throws a 409 StaleDocumentError when no row matched', async () => {
    calls.result = { data: [], error: null };
    const err = await saveParty(party(), 'stale').catch((e) => e);
    expect(err).toBeInstanceOf(StaleDocumentError);
    expect(err.status).toBe(409);
  });

  it('upserts unconditionally without a precondition, as before', async () => {
    await saveSheet({ CharacterId: 'ch-1' } as CharacterSheet, 'cm-1');
    expect(calls.upserts).toHaveLength(1);
    expect(calls.updateRows).toHaveLength(0);
  });

  it('stamps a new UpdatedAt on every save, so the next writer must hold this one', async () => {
    const p = party();
    await saveParty(p);
    expect(p.UpdatedAt).not.toBe('old');
  });
});
