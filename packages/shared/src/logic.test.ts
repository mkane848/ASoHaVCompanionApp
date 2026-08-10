import { describe, expect, it } from 'vitest';
import {
  isStandardVirtueArray,
  applySpendKin,
  assertInviteActionable,
  assertCampaignActive,
  assertPartyCreationPhase,
  assertValidPhaseTransition,
  campaignPhase,
  isBondLocked,
  normalizeLibrary,
  normalizeSheet,
  partyReadiness,
  BondHandshakeError,
  CampaignArchivedError,
  InviteError,
  InvalidPhaseTransitionError,
  PartyCreationRequiredError,
  STANDARD_VIRTUE_ARRAY,
  pendingBondCountFor,
} from './logic.js';
import { seedLibrary } from './seedLibrary.js';
import type { Bond, Campaign, CharacterSheet, Invite, Library, Membership } from './types.js';

function makeSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    Id: 'sh-1',
    CharacterId: 'ch-1',
    Looks: '',
    Virtues: [],
    Statuses: [],
    Armor: [],
    Theme: { ThemeId: 't-1', AcceptedQuests: [] },
    Load: { Tier: 'Normal', LatchedUntilCamp: false },
    Items: [],
    AbilityIds: [],
    SkillIds: [],
    Advancement: { Potential: 0, PotentialAdvancementsTaken: [], History: [] },
    Recoveries: 6,
    Scars: [],
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

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

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { Id: 'cm-1', Name: 'The Long Road South', GmUserId: 'u-mike', CreatedAt: new Date().toISOString(), Status: 'Active', ...overrides };
}

describe('assertCampaignActive', () => {
  it('allows an Active campaign', () => {
    expect(() => assertCampaignActive(makeCampaign({ Status: 'Active' }))).not.toThrow();
  });

  it('rejects an Archived campaign', () => {
    expect(() => assertCampaignActive(makeCampaign({ Status: 'Archived' }))).toThrow(CampaignArchivedError);
  });
});

describe('campaignPhase', () => {
  it('returns the set Phase', () => {
    expect(campaignPhase(makeCampaign({ Phase: 'Signup' }))).toBe('Signup');
  });

  it('defaults a missing Phase to PartyCreation', () => {
    const { Phase, ...withoutPhase } = makeCampaign({ Phase: 'Signup' });
    expect(campaignPhase(withoutPhase as Campaign)).toBe('PartyCreation');
  });
});

describe('assertPartyCreationPhase', () => {
  it('allows a campaign in Party Creation', () => {
    expect(() => assertPartyCreationPhase(makeCampaign({ Phase: 'PartyCreation' }))).not.toThrow();
  });

  it('rejects Signup', () => {
    expect(() => assertPartyCreationPhase(makeCampaign({ Phase: 'Signup' }))).toThrow(PartyCreationRequiredError);
  });

  it('rejects Playing', () => {
    expect(() => assertPartyCreationPhase(makeCampaign({ Phase: 'Playing' }))).toThrow(PartyCreationRequiredError);
  });
});

describe('assertValidPhaseTransition', () => {
  it('allows Signup -> PartyCreation', () => {
    expect(() => assertValidPhaseTransition('Signup', 'PartyCreation')).not.toThrow();
  });

  it('allows PartyCreation -> Playing', () => {
    expect(() => assertValidPhaseTransition('PartyCreation', 'Playing')).not.toThrow();
  });

  it('allows PartyCreation -> Signup (reopening)', () => {
    expect(() => assertValidPhaseTransition('PartyCreation', 'Signup')).not.toThrow();
  });

  it('rejects skipping Signup straight to Playing', () => {
    expect(() => assertValidPhaseTransition('Signup', 'Playing')).toThrow(InvalidPhaseTransitionError);
  });

  it('rejects any move out of Playing', () => {
    expect(() => assertValidPhaseTransition('Playing', 'Signup')).toThrow(InvalidPhaseTransitionError);
    expect(() => assertValidPhaseTransition('Playing', 'PartyCreation')).toThrow(InvalidPhaseTransitionError);
  });
});

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return { Id: 'mb-1', UserId: 'u-1', CampaignId: 'cm-1', Role: 'Player', CharacterId: 'ch-1', ...overrides };
}

describe('partyReadiness', () => {
  it('counts only Player memberships, ignoring the GM', () => {
    const members = [
      makeMembership({ Id: 'mb-gm', Role: 'GM', CharacterId: null, Ready: true }),
      makeMembership({ Id: 'mb-1', Ready: true }),
      makeMembership({ Id: 'mb-2', Ready: false }),
    ];
    expect(partyReadiness(members)).toEqual({ ready: 1, total: 2 });
  });

  it('treats a missing Ready as not ready', () => {
    const members = [makeMembership({ Id: 'mb-1' })];
    expect(partyReadiness(members)).toEqual({ ready: 0, total: 1 });
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

describe('normalizeSheet', () => {
  it('leaves an already-complete sheet untouched', () => {
    const sheet = makeSheet({ Recoveries: 3, Scars: [{ Id: 'sc-1', Text: 'A scar', At: new Date().toISOString() }] });
    expect(normalizeSheet(sheet)).toEqual(sheet);
  });

  it('defaults Recoveries to 0 and Scars to [] on a pre-0.13.0 sheet missing both fields', () => {
    const sheet = makeSheet();
    // Simulate a sheet written before Recoveries/Scars existed on CharacterSheet — the JSONB
    // blob simply has no such keys, so a real read from Postgres deserializes them as undefined.
    delete (sheet as Partial<CharacterSheet>).Recoveries;
    delete (sheet as Partial<CharacterSheet>).Scars;

    const normalized = normalizeSheet(sheet);
    expect(normalized.Recoveries).toBe(0);
    expect(normalized.Scars).toEqual([]);
  });
});

describe('normalizeLibrary', () => {
  it('leaves an already-complete library untouched, preserving object identity', () => {
    const library = seedLibrary();
    const normalized = normalizeLibrary(library);
    expect(normalized).toEqual(library);
    expect(normalized.settings).toBe(library.settings);
    expect(normalized.glossary).toBe(library.glossary);
    expect(normalized.enemies).toBe(library.enemies);
  });

  it('backfills glossary/enemies to [] and the 0.13.0/0.14.0 GameSettings fields to their seed defaults on a stale library', () => {
    const library = seedLibrary();
    delete (library as Partial<Library>).glossary;
    delete (library as Partial<Library>).enemies;
    const staleSettings = { ...library.settings };
    delete (staleSettings as Partial<Library['settings']>).SkillsAtCreation;
    delete (staleSettings as Partial<Library['settings']>).AdvancementTier2At;
    delete (staleSettings as Partial<Library['settings']>).AdvancementTier3At;
    delete (staleSettings as Partial<Library['settings']>).AdvancementTier4At;
    delete (staleSettings as Partial<Library['settings']>).RecoveriesMax;
    library.settings = staleSettings;

    const normalized = normalizeLibrary(library);
    expect(normalized.glossary).toEqual([]);
    expect(normalized.enemies).toEqual([]);
    expect(normalized.settings.SkillsAtCreation).toBe(2);
    expect(normalized.settings.AdvancementTier2At).toBe(4);
    expect(normalized.settings.AdvancementTier3At).toBe(7);
    expect(normalized.settings.AdvancementTier4At).toBe(10);
    expect(normalized.settings.RecoveriesMax).toBe(6);
  });

  it('preserves an already-present field rather than overwriting it with the default', () => {
    const library = seedLibrary();
    library.settings = { ...library.settings, RecoveriesMax: 8 };
    expect(normalizeLibrary(library).settings.RecoveriesMax).toBe(8);
  });
});

describe('isBondLocked / applySpendKin', () => {
  it('is not locked below max Level or a partial Kin Track', () => {
    expect(isBondLocked(makeBond({ BondLevel: 4, KinTrack: 5 }))).toBe(false);
    expect(isBondLocked(makeBond({ BondLevel: 5, KinTrack: 4 }))).toBe(false);
  });

  it('locks once Bond Level and Kin Track are both maxed', () => {
    expect(isBondLocked(makeBond({ BondLevel: 5, KinTrack: 5 }))).toBe(true);
  });

  it('applySpendKin decrements KinTrack normally when not locked', () => {
    const bond = makeBond({ BondLevel: 3, KinTrack: 3 });
    applySpendKin(bond);
    expect(bond.KinTrack).toBe(2);
    expect(bond.BondLevel).toBe(3);
  });

  it('applySpendKin drops BondLevel by one and resets KinTrack to 4 when it would go negative', () => {
    const bond = makeBond({ BondLevel: 3, KinTrack: 0 });
    applySpendKin(bond);
    expect(bond.BondLevel).toBe(2);
    expect(bond.KinTrack).toBe(4);
  });

  it('throws BondHandshakeError and leaves the Bond untouched once locked at max Level with a full Kin Track', () => {
    const bond = makeBond({ BondLevel: 5, KinTrack: 5 });
    expect(() => applySpendKin(bond)).toThrow(BondHandshakeError);
    expect(bond.BondLevel).toBe(5);
    expect(bond.KinTrack).toBe(5);
  });
});
