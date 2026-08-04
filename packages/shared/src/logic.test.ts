import { describe, expect, it } from 'vitest';
import { isStandardVirtueArray, assertInviteActionable, InviteError, STANDARD_VIRTUE_ARRAY } from './logic.js';
import type { Invite } from './types.js';

describe('isStandardVirtueArray', () => {
  it('accepts the standard array in any order', () => {
    expect(isStandardVirtueArray([2, 1, 0, 0, -1])).toBe(true);
    expect(isStandardVirtueArray([-1, 0, 0, 1, 2])).toBe(true);
    expect(isStandardVirtueArray([0, 2, -1, 1, 0])).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isStandardVirtueArray([2, 1, 0, 0])).toBe(false);
    expect(isStandardVirtueArray([2, 1, 0, 0, -1, 0])).toBe(false);
  });

  it('rejects a duplicate that is not in the standard multiset (free allocation)', () => {
    expect(isStandardVirtueArray([2, 2, 0, 0, -1])).toBe(false);
    expect(isStandardVirtueArray([3, 1, 0, 0, -1])).toBe(false);
  });

  it('rejects all-zero (every point spent evenly, not the real array)', () => {
    expect(isStandardVirtueArray([0, 0, 0, 0, 0])).toBe(false);
  });

  it('does not mutate STANDARD_VIRTUE_ARRAY', () => {
    const before = [...STANDARD_VIRTUE_ARRAY];
    isStandardVirtueArray([2, 1, 0, 0, -1]);
    expect(STANDARD_VIRTUE_ARRAY).toEqual(before);
  });
});

function makeInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    Id: 'inv-1',
    CampaignId: 'cm-1',
    Email: 'mike@asohav.dev',
    Code: 'ROAD-1234',
    SentAt: new Date().toISOString(),
    Status: 'Pending',
    ...overrides,
  };
}

describe('assertInviteActionable', () => {
  it('allows a Pending invite whose email matches, case-insensitively', () => {
    const invite = makeInvite({ Email: 'Mike@ASoHaV.dev' });
    expect(() => assertInviteActionable(invite, 'mike@asohav.dev')).not.toThrow();
  });

  it('rejects an invite addressed to a different email', () => {
    const invite = makeInvite({ Email: 'someone-else@asohav.dev' });
    expect(() => assertInviteActionable(invite, 'mike@asohav.dev')).toThrow(InviteError);
  });

  it('rejects an already-accepted invite', () => {
    const invite = makeInvite({ Status: 'Accepted' });
    expect(() => assertInviteActionable(invite, 'mike@asohav.dev')).toThrow(InviteError);
  });

  it('rejects an already-declined invite', () => {
    const invite = makeInvite({ Status: 'Declined' });
    expect(() => assertInviteActionable(invite, 'mike@asohav.dev')).toThrow(InviteError);
  });

  it('rejects a revoked invite', () => {
    const invite = makeInvite({ Status: 'Revoked' });
    expect(() => assertInviteActionable(invite, 'mike@asohav.dev')).toThrow(InviteError);
  });
});
