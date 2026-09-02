import { describe, expect, it } from 'vitest';
import {
  isStandardVirtueArray,
  applySpendBond,
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
  STANDARD_VIRTUE_ARRAYS,
  pendingBondCountFor,
  allConditionsMarked,
  markCondition,
  spendRecovery,
  CONDITION_COUNT,
  addMotifPotential,
  emptyMotif,
  markActBreak,
  markForsake,
  questComplete,
  questAbandoned,
  takeMotifAdvance,
  MOTIF_ADVANCE_OPTIONS,
  improvementState,
  normalizeParty,
  clearRapportForPartyLevel,
} from './logic.js';
import { seedLibrary } from './seedLibrary.js';
import { seedParty } from './seedPlay.js';
import type { Bond, Campaign, CharacterMotif, CharacterSheet, Improvement, Invite, Library, Membership, Party } from './types.js';

function makeSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    Id: 'sh-1',
    CharacterId: 'ch-1',
    Looks: '',
    Virtues: [],
    Statuses: [],
    Armor: [],
    Motifs: [emptyMotif(), emptyMotif(), emptyMotif()],
    Load: { Tier: 'Normal', LatchedUntilCamp: false },
    Items: [],
    Advancement: { History: [] },
    Improvements: [],
    Level: 0,
    Recoveries: 6,
    Scars: [],
    Wealth: 0,
    Treasure: 0,
    Hold: 0,
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('isStandardVirtueArray', () => {
  it('rejects the old pre-correction single array (retired — see STANDARD_VIRTUE_ARRAYS)', () => {
    expect(isStandardVirtueArray([2, 1, 0, 0, -1])).toBe(false);
  });

  it('accepts each of the five canonical arrays, in any order', () => {
    expect(isStandardVirtueArray([2, 1, 1, 0, -1])).toBe(true);
    expect(isStandardVirtueArray([-1, 0, 1, 1, 2])).toBe(true);

    expect(isStandardVirtueArray([2, 2, 1, -1, -1])).toBe(true);
    expect(isStandardVirtueArray([-1, -1, 1, 2, 2])).toBe(true);

    expect(isStandardVirtueArray([2, 1, 0, 0, 0])).toBe(true);
    expect(isStandardVirtueArray([0, 0, 2, 1, 0])).toBe(true);

    expect(isStandardVirtueArray([1, 1, 1, 1, -1])).toBe(true);
    expect(isStandardVirtueArray([-1, 1, 1, 1, 1])).toBe(true);

    expect(isStandardVirtueArray([1, 1, 1, 0, 0])).toBe(true);
    expect(isStandardVirtueArray([0, 1, 0, 1, 1])).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isStandardVirtueArray([2, 1, 1, 0])).toBe(false);
    expect(isStandardVirtueArray([2, 1, 1, 0, -1, 0])).toBe(false);
  });

  it('rejects a multiset that pools values from different arrays rather than matching one whole array', () => {
    // Sum is 3 and every individual value (2, 0, -1) appears in *some* canonical array, but this
    // exact multiset matches none of the five — guards against a "pooled value" implementation bug.
    expect(isStandardVirtueArray([2, 2, 0, 0, -1])).toBe(false);
  });

  it('rejects a duplicate that is not in any standard multiset (free allocation)', () => {
    expect(isStandardVirtueArray([3, 1, 0, 0, -1])).toBe(false);
  });

  it('rejects all-zero (every point spent evenly, not a real array)', () => {
    expect(isStandardVirtueArray([0, 0, 0, 0, 0])).toBe(false);
  });

  it('does not mutate STANDARD_VIRTUE_ARRAYS', () => {
    const before = STANDARD_VIRTUE_ARRAYS.map((arr) => [...arr]);
    isStandardVirtueArray([2, 1, 1, 0, -1]);
    expect(STANDARD_VIRTUE_ARRAYS.map((arr) => [...arr])).toEqual(before);
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
    BondTrack: 0,
    BondLevel: 0,
    BondMoves: [],
    PendingChange: null,
    History: [],
    UpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function pendingChange(proposedBy: string) {
  return { Id: 'pc-1', ProposedBy: proposedBy, Type: 'MarkBond' as const, Payload: { Delta: 1 }, Note: 'x', ProposedAt: new Date().toISOString() };
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

  it('defaults Recoveries to a full pool and Scars to [] on a pre-0.13.0 sheet missing both fields', () => {
    const sheet = makeSheet();
    // Simulate a sheet written before Recoveries/Scars existed on CharacterSheet — the JSONB
    // blob simply has no such keys, so a real read from Postgres deserializes them as undefined.
    delete (sheet as Partial<CharacterSheet>).Recoveries;
    delete (sheet as Partial<CharacterSheet>).Scars;

    const normalized = normalizeSheet(sheet);
    // Deliberately RecoveriesMax, not 0, as of `0.28.0`: an empty pool now inflicts the
    // Exhausted Condition (see spendRecovery), so backfilling 0 would hand an old sheet a
    // Condition it never earned the moment it was read.
    expect(normalized.Recoveries).toBe(6);
    expect(normalized.Scars).toEqual([]);
  });

  it('defaults Wealth, Treasure, and Hold to 0 on a pre-0.18.0 sheet missing all three', () => {
    const sheet = makeSheet();
    delete (sheet as Partial<CharacterSheet>).Wealth;
    delete (sheet as Partial<CharacterSheet>).Treasure;
    delete (sheet as Partial<CharacterSheet>).Hold;

    const normalized = normalizeSheet(sheet);
    expect(normalized.Wealth).toBe(0);
    expect(normalized.Treasure).toBe(0);
    expect(normalized.Hold).toBe(0);
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
    expect(normalized.improvementTrees).toBe(library.improvementTrees);
    expect(normalized.improvements).toBe(library.improvements);
  });

  it('backfills glossary/enemies/improvementTrees/improvements to [] and stale GameSettings fields to their seed defaults', () => {
    const library = seedLibrary();
    delete (library as Partial<Library>).glossary;
    delete (library as Partial<Library>).enemies;
    delete (library as Partial<Library>).improvementTrees;
    delete (library as Partial<Library>).improvements;
    const staleSettings = { ...library.settings };
    delete (staleSettings as Partial<Library['settings']>).RecoveriesMax;
    library.settings = staleSettings;

    const normalized = normalizeLibrary(library);
    expect(normalized.glossary).toEqual([]);
    expect(normalized.enemies).toEqual([]);
    expect(normalized.improvementTrees).toEqual([]);
    expect(normalized.improvements).toEqual([]);
    expect(normalized.settings.RecoveriesMax).toBe(6);
  });

  it('preserves an already-present field rather than overwriting it with the default', () => {
    const library = seedLibrary();
    library.settings = { ...library.settings, RecoveriesMax: 8 };
    expect(normalizeLibrary(library).settings.RecoveriesMax).toBe(8);
  });
});

describe('isBondLocked / applySpendBond', () => {
  it('is not locked below max Level or a partial Bond Track', () => {
    expect(isBondLocked(makeBond({ BondLevel: 4, BondTrack: 5 }))).toBe(false);
    expect(isBondLocked(makeBond({ BondLevel: 5, BondTrack: 4 }))).toBe(false);
  });

  it('locks once Bond Level and Bond Track are both maxed', () => {
    expect(isBondLocked(makeBond({ BondLevel: 5, BondTrack: 5 }))).toBe(true);
  });

  it('applySpendBond decrements BondTrack normally when not locked', () => {
    const bond = makeBond({ BondLevel: 3, BondTrack: 3 });
    applySpendBond(bond);
    expect(bond.BondTrack).toBe(2);
    expect(bond.BondLevel).toBe(3);
  });

  it('applySpendBond drops BondLevel by one and resets BondTrack to 4 when it would go negative', () => {
    const bond = makeBond({ BondLevel: 3, BondTrack: 0 });
    applySpendBond(bond);
    expect(bond.BondLevel).toBe(2);
    expect(bond.BondTrack).toBe(4);
  });

  it('throws BondHandshakeError and leaves the Bond untouched once locked at max Level with a full Bond Track', () => {
    const bond = makeBond({ BondLevel: 5, BondTrack: 5 });
    expect(() => applySpendBond(bond)).toThrow(BondHandshakeError);
    expect(bond.BondLevel).toBe(5);
    expect(bond.BondTrack).toBe(5);
  });
});


describe('markCondition — the Crumble trigger', () => {
  /** Sheet with the first `marked` of the five Virtues Condition-marked. */
  function sheetWith(marked: number): CharacterSheet {
    const ids = ['v-might', 'v-mettle', 'v-heart', 'v-wit', 'v-guile'];
    return makeSheet({
      Virtues: ids.map((VirtueId, i) => ({ VirtueId, Score: 0, ConditionMarked: i < marked })),
    });
  }

  it('marks a free Condition and does not Crumble', () => {
    const sheet = sheetWith(0);
    expect(markCondition(sheet, 'v-heart')).toEqual({ Crumbled: false });
    expect(sheet.Virtues.find((v) => v.VirtueId === 'v-heart')!.ConditionMarked).toBe(true);
  });

  it('is a no-op on an already-marked Virtue, not a Crumble', () => {
    // V0.5: "You can not mark a Condition that has already been marked." That is a nothing-
    // happens, not a consequence — the Crumble case is specifically "no Conditions left at all".
    const sheet = sheetWith(1);
    expect(markCondition(sheet, 'v-might')).toEqual({ Crumbled: false });
    expect(sheet.Virtues.filter((v) => v.ConditionMarked)).toHaveLength(1);
  });

  it('Crumbles, and marks nothing, once all five are marked', () => {
    const sheet = sheetWith(CONDITION_COUNT);
    expect(markCondition(sheet, 'v-guile')).toEqual({ Crumbled: true });
    expect(sheet.Virtues.filter((v) => v.ConditionMarked)).toHaveLength(CONDITION_COUNT);
  });

  it('allConditionsMarked reports the state Crumble fires from', () => {
    expect(allConditionsMarked(sheetWith(4))).toBe(false);
    expect(allConditionsMarked(sheetWith(CONDITION_COUNT))).toBe(true);
  });
});

describe('spendRecovery — the Recoveries-0 cascade', () => {
  function sheetWith(recoveries: number, mightMarked = false): CharacterSheet {
    const ids = ['v-might', 'v-mettle', 'v-heart', 'v-wit', 'v-guile'];
    return makeSheet({
      Recoveries: recoveries,
      Virtues: ids.map((VirtueId) => ({ VirtueId, Score: 0, ConditionMarked: VirtueId === 'v-might' ? mightMarked : false })),
    });
  }

  it('decrements without consequence while the pool holds', () => {
    const sheet = sheetWith(3);
    expect(spendRecovery(sheet, 'v-might')).toEqual({ Exhausted: false, Crumbled: false });
    expect(sheet.Recoveries).toBe(2);
  });

  it('gives the Exhausted Condition when the pool reaches 0', () => {
    const sheet = sheetWith(1);
    expect(spendRecovery(sheet, 'v-might')).toEqual({ Exhausted: true, Crumbled: false });
    expect(sheet.Recoveries).toBe(0);
    expect(sheet.Virtues.find((v) => v.VirtueId === 'v-might')!.ConditionMarked).toBe(true);
  });

  it('cascades into a Crumble when Exhausted is already marked and every other Condition is too', () => {
    // The three-step chain: last Recovery -> Exhausted -> nothing left to mark -> Crumble.
    const sheet = makeSheet({
      Recoveries: 1,
      Virtues: ['v-might', 'v-mettle', 'v-heart', 'v-wit', 'v-guile'].map((VirtueId) => ({
        VirtueId,
        Score: 0,
        ConditionMarked: true,
      })),
    });
    expect(spendRecovery(sheet, 'v-might')).toEqual({ Exhausted: true, Crumbled: true });
  });

  it('does not Crumble when Might alone is already marked — that is just a no-op mark', () => {
    const sheet = sheetWith(1, true);
    expect(spendRecovery(sheet, 'v-might')).toEqual({ Exhausted: true, Crumbled: false });
  });

  it('floors at 0 rather than going negative', () => {
    const sheet = sheetWith(0);
    spendRecovery(sheet, 'v-might');
    expect(sheet.Recoveries).toBe(0);
  });
});

describe('Motif helpers', () => {
  function makeMotif(overrides: Partial<CharacterMotif> = {}): CharacterMotif {
    return {
      MotifId: null,
      Name: 'Sworn',
      SkillTags: [],
      FlawTags: [],
      Potential: 0,
      Quest: '',
      ActBreaks: 0,
      Forsakes: 0,
      ...overrides,
    };
  }

  it('emptyMotif is a blank slot', () => {
    expect(emptyMotif()).toEqual({
      MotifId: null, Name: '', SkillTags: [], FlawTags: [], Potential: 0, Quest: '', ActBreaks: 0, Forsakes: 0,
    });
  });

  it('addMotifPotential increments and reports readiness only at the cap', () => {
    const m = makeMotif({ Potential: 4 });
    expect(addMotifPotential(m, 1, 5)).toEqual({ ready: true });
    expect(m.Potential).toBe(5);
    const under = makeMotif();
    expect(addMotifPotential(under, 3, 5)).toEqual({ ready: false });
    expect(under.Potential).toBe(3);
  });

  it('addMotifPotential never exceeds the cap', () => {
    const m = makeMotif({ Potential: 4 });
    addMotifPotential(m, 9, 5);
    expect(m.Potential).toBe(5);
  });

  it('markActBreak completes the Quest at three', () => {
    const m = makeMotif({ ActBreaks: 2 });
    expect(markActBreak(m)).toEqual({ questComplete: true });
    expect(m.ActBreaks).toBe(3);
    expect(questComplete(m)).toBe(true);
  });

  it('markActBreak clamps at three and does not report a repeat completion', () => {
    const m = makeMotif({ ActBreaks: 3 });
    expect(markActBreak(m)).toEqual({ questComplete: true });
    expect(m.ActBreaks).toBe(3);
  });

  it('markForsake abandons the Quest at three', () => {
    const m = makeMotif({ Forsakes: 2 });
    expect(markForsake(m)).toEqual({ questAbandoned: true });
    expect(m.Forsakes).toBe(3);
    expect(questAbandoned(m)).toBe(true);
  });

  it('markForsake clamps at three', () => {
    const m = makeMotif({ Forsakes: 3 });
    markForsake(m);
    expect(m.Forsakes).toBe(3);
  });

  it('takeMotifAdvance clears Potential and offers all four choices', () => {
    const m = makeMotif({ Potential: 5 });
    expect(takeMotifAdvance(m)).toEqual([...MOTIF_ADVANCE_OPTIONS]);
    expect(m.Potential).toBe(0);
  });
});

describe('improvementState — the Improvement Tree DAG gate (slice 4)', () => {
  function makeImprovement(overrides: Partial<Improvement> = {}): Improvement {
    return { Id: 'im-x', TreeId: 'it-strike', Name: 'X', Effect: '', IsStarting: false, PrerequisiteIds: [], ...overrides };
  }

  it('a Starting Improvement is always available, never locked, regardless of what is held', () => {
    const starting = makeImprovement({ Id: 'im-start', IsStarting: true });
    expect(improvementState(starting, new Set())).toBe('available');
  });

  it('a held Improvement reports held even if it is also a Starting Improvement', () => {
    const starting = makeImprovement({ Id: 'im-start', IsStarting: true });
    expect(improvementState(starting, new Set(['im-start']))).toBe('held');
  });

  it('a non-starting Improvement is locked until one of its prerequisites is held', () => {
    const node = makeImprovement({ Id: 'im-2', PrerequisiteIds: ['im-start'] });
    expect(improvementState(node, new Set())).toBe('locked');
    expect(improvementState(node, new Set(['im-start']))).toBe('available');
  });

  it('any one held prerequisite is enough, not all of them', () => {
    const node = makeImprovement({ Id: 'im-3', PrerequisiteIds: ['im-a', 'im-b'] });
    expect(improvementState(node, new Set(['im-b']))).toBe('available');
  });
});

describe('normalizeParty', () => {
  it('leaves an already-complete party untouched, preserving object identity', () => {
    const party = seedParty();
    const normalized = normalizeParty(party);
    expect(normalized).toEqual(party);
    expect(normalized.RapportImprovementsTaken).toBe(party.RapportImprovementsTaken);
  });

  it('backfills RapportImprovementsTaken/PartyLevel on a pre-slice-4 party, carrying over a legacy RapportAdvancementsTaken array', () => {
    const party = seedParty() as Partial<Party> & { RapportAdvancementsTaken?: unknown[] };
    delete party.RapportImprovementsTaken;
    delete party.PartyLevel;
    party.RapportAdvancementsTaken = [{ Id: 'ad-old', Name: 'Old pick', Tier: 1, Effect: '', TakenAt: '2026-01-01T00:00:00Z' }];

    const normalized = normalizeParty(party as Party);
    expect(normalized.PartyLevel).toBe(0);
    expect(normalized.RapportImprovementsTaken).toEqual(party.RapportAdvancementsTaken);
  });
});

describe('clearRapportForPartyLevel', () => {
  it('clears Rapport, raises PartyLevel, and logs a History entry', () => {
    const party = seedParty();
    party.Rapport = 5;
    party.PartyLevel = 2;
    const historyLenBefore = party.History.length;

    clearRapportForPartyLevel(party);

    expect(party.Rapport).toBe(0);
    expect(party.PartyLevel).toBe(3);
    expect(party.History).toHaveLength(historyLenBefore + 1);
    expect(party.History[0].Name).toBe('Progress the Party');
  });

  it('defaults a missing PartyLevel to 0 before incrementing', () => {
    const party = seedParty();
    delete (party as Partial<Party>).PartyLevel;
    clearRapportForPartyLevel(party);
    expect(party.PartyLevel).toBe(1);
  });
});
