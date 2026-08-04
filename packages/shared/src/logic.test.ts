import { describe, expect, it } from 'vitest';
import { isStandardVirtueArray, assertInviteActionable, InviteError, STANDARD_VIRTUE_ARRAY, pendingBondCountFor } from './logic.js';
import type { Bond, Invite } from './types.js';

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

function makeBond(overrides: Partial<Bond> = {}): Bond {
  return {
    Id: 'bd-1',
    CampaignId: 'cm-1',
    CharacterAId: 'ch-a',
    CharacterBId: 'ch-b',
    KinTrack: 0,
    BondLevel: 0,
    BondMoves: [],
    PendingChange: null,
    History: [],
    UpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function pendingChange(proposedBy: string) {
  return { Id: 'pc-1', ProposedBy: proposedBy, Type: 'MarkKin' as const, Payload: { Delta: 1 }, Note: 'x', ProposedAt: new Date().toISOString() };
}

describe('pendingBondCountFor', () => {
  it('counts a Bond proposed by the other party as incoming', () => {
    const bonds = [makeBond({ CharacterAId: 'ch-a', CharacterBId: 'ch-b', PendingChange: pendingChange('ch-b') })];
    expect(pendingBondCountFor(bonds, 'ch-a')).toBe(1);
  });

  it('does not count a Bond the viewer proposed themselves', () => {
    const bonds = [makeBond({ CharacterAId: 'ch-a', CharacterBId: 'ch-b', PendingChange: pendingChange('ch-a') })];
    expect(pendingBondCountFor(bonds, 'ch-a')).toBe(0);
  });

  it('does not count a Bond with no pending change', () => {
    const bonds = [makeBond({ CharacterAId: 'ch-a', CharacterBId: 'ch-b', PendingChange: null })];
    expect(pendingBondCountFor(bonds, 'ch-a')).toBe(0);
  });

  it('ignores Bonds the character is not part of', () => {
    const bonds = [makeBond({ CharacterAId: 'ch-x', CharacterBId: 'ch-y', PendingChange: pendingChange('ch-y') })];
    expect(pendingBondCountFor(bonds, 'ch-a')).toBe(0);
  });

  it('counts across multiple Bonds, from either seat (A or B)', () => {
    const bonds = [
      makeBond({ Id: 'bd-1', CharacterAId: 'ch-a', CharacterBId: 'ch-b', PendingChange: pendingChange('ch-b') }),
      makeBond({ Id: 'bd-2', CharacterAId: 'ch-c', CharacterBId: 'ch-a', PendingChange: pendingChange('ch-c') }),
      makeBond({ Id: 'bd-3', CharacterAId: 'ch-a', CharacterBId: 'ch-d', PendingChange: pendingChange('ch-a') }),
    ];
    expect(pendingBondCountFor(bonds, 'ch-a')).toBe(2);
  });
});
