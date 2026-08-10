import { describe, expect, it } from 'vitest';
import { applyDishonoredVulnerable, applyToughness, engageBaseRank, firstToActFromInitiative, gambitConditionCost, isEnemyDefeated, newParticipant, rangeBandDistance, shiftRange, startNewRound } from './combat.js';
import type { CharacterSheet } from './types.js';

const VIRTUE_IDS = ['v-might', 'v-mettle', 'v-heart', 'v-wit', 'v-guile'];

function makeSheet(markedCount: number): CharacterSheet {
  return {
    Id: 'sh-1',
    CharacterId: 'ch-1',
    Looks: '',
    Virtues: VIRTUE_IDS.map((VirtueId, i) => ({ VirtueId, Score: 0, ConditionMarked: i < markedCount })),
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
  };
}

describe('shiftRange', () => {
  it('moves toward Melee on a negative delta', () => {
    expect(shiftRange('Far', -1)).toBe('Close');
  });

  it('moves toward Out of Range on a positive delta', () => {
    expect(shiftRange('Close', 2)).toBe('VeryFar');
  });

  it('clamps at Melee', () => {
    expect(shiftRange('Melee', -3)).toBe('Melee');
  });

  it('clamps at Out of Range', () => {
    expect(shiftRange('VeryFar', 5)).toBe('OutOfRange');
  });
});

describe('engageBaseRank', () => {
  it('gives the Melee table', () => {
    expect(engageBaseRank('Melee', 'Tier3')).toBe(5);
    expect(engageBaseRank('Melee', 'Tier2')).toBe(4);
    expect(engageBaseRank('Melee', 'Tier1')).toBe(3);
  });

  it('gives the Ranged table', () => {
    expect(engageBaseRank('Ranged', 'Tier3')).toBe(4);
    expect(engageBaseRank('Ranged', 'Tier2')).toBe(3);
    expect(engageBaseRank('Ranged', 'Tier1')).toBe(2);
  });
});

describe('applyToughness', () => {
  it('passes through unchanged for None', () => {
    expect(applyToughness(5, 'Tier3', 'Melee', 'None')).toBe(5);
  });

  it('subtracts 2 for Medium, floored at 1', () => {
    expect(applyToughness(5, 'Tier3', 'Melee', 'Medium')).toBe(3);
    expect(applyToughness(2, 'Tier1', 'Melee', 'Medium')).toBe(1);
  });

  it('treats Heavy as one tier lower', () => {
    expect(applyToughness(5, 'Tier3', 'Melee', 'Heavy')).toBe(4); // Tier3->Tier2 melee rank
    expect(applyToughness(3, 'Tier1', 'Melee', 'Heavy')).toBe(3); // Tier1 has no lower tier
  });

  it('leaves a non-positive base Rank alone', () => {
    expect(applyToughness(0, 'Tier1', 'Ranged', 'Heavy')).toBe(0);
  });
});

describe('isEnemyDefeated', () => {
  it('is false with no matching Status at/over its Limit', () => {
    expect(isEnemyDefeated([{ Name: 'Hurt', Rank: 2 }], [{ StatusName: 'Hurt', Limit: 4 }])).toBe(false);
  });

  it('is true once any one Limit is reached', () => {
    expect(isEnemyDefeated([{ Name: 'Hurt', Rank: 4 }], [{ StatusName: 'Hurt', Limit: 4 }, { StatusName: 'Scared', Limit: 3 }])).toBe(true);
  });

  it('matches Status names case-insensitively', () => {
    expect(isEnemyDefeated([{ Name: 'hurt', Rank: 5 }], [{ StatusName: 'Hurt', Limit: 4 }])).toBe(true);
  });

  it('is false with no Statuses or no Limits', () => {
    expect(isEnemyDefeated(undefined, [{ StatusName: 'Hurt', Limit: 4 }])).toBe(false);
    expect(isEnemyDefeated([{ Name: 'Hurt', Rank: 10 }], [])).toBe(false);
  });
});

describe('newParticipant', () => {
  it('builds a PC participant with no Enemy-only fields', () => {
    const p = newParticipant({ Kind: 'PC', RefId: 'ch-1', Name: 'Ember' });
    expect(p.Kind).toBe('PC');
    expect(p.ActionPointsRemaining).toBe(3);
    expect(p.Toughness).toBeUndefined();
    expect(p.Statuses).toBeUndefined();
  });

  it('builds an Enemy participant with Toughness/StatusLimits/Statuses defaulted', () => {
    const p = newParticipant({ Kind: 'Enemy', RefId: 'en-brigand', Name: 'Brigand', Toughness: 'Medium', StatusLimits: [{ StatusName: 'Hurt', Limit: 4 }] });
    expect(p.Toughness).toBe('Medium');
    expect(p.StatusLimits).toEqual([{ StatusName: 'Hurt', Limit: 4 }]);
    expect(p.Statuses).toEqual([]);
    expect(p.Defeated).toBe(false);
  });
});

describe('startNewRound', () => {
  it('refills AP and clears the acted flag for everyone', () => {
    const participants = [
      { Id: 'a', Kind: 'PC' as const, RefId: 'ch-1', Name: 'A', Range: 'Close' as const, ActionPointsRemaining: 0, HasActedThisRound: true, Unstable: false },
    ];
    const next = startNewRound(participants);
    expect(next[0].ActionPointsRemaining).toBe(3);
    expect(next[0].HasActedThisRound).toBe(false);
  });
});

describe('firstToActFromInitiative', () => {
  it('gives the party a 7+', () => {
    expect(firstToActFromInitiative(7)).toBe('Party');
    expect(firstToActFromInitiative(11)).toBe('Party');
  });

  it('gives the enemies a 6-', () => {
    expect(firstToActFromInitiative(6)).toBe('Enemies');
    expect(firstToActFromInitiative(2)).toBe('Enemies');
  });
});

describe('rangeBandDistance', () => {
  it('is 0 for the same Range', () => {
    expect(rangeBandDistance('Close', 'Close')).toBe(0);
  });

  it('counts bands apart in either direction', () => {
    expect(rangeBandDistance('Melee', 'Far')).toBe(2);
    expect(rangeBandDistance('OutOfRange', 'Close')).toBe(3);
  });
});

describe('gambitConditionCost', () => {
  it('allows none on a miss', () => {
    expect(gambitConditionCost('Tier1', 0, false)).toBe(0);
  });

  it('costs 2 Conditions for the single Gambit on a 7-9, regardless of a (impossible) 12+ flag', () => {
    expect(gambitConditionCost('Tier2', 0, false)).toBe(2);
    expect(gambitConditionCost('Tier2', 0, true)).toBe(2);
  });

  it('costs 1 Condition per Gambit on a 10+', () => {
    expect(gambitConditionCost('Tier3', 0, false)).toBe(1);
    expect(gambitConditionCost('Tier3', 1, false)).toBe(1);
  });

  it('makes only the first Gambit free on an exact 12+', () => {
    expect(gambitConditionCost('Tier3', 0, true)).toBe(0);
    expect(gambitConditionCost('Tier3', 1, true)).toBe(1);
  });
});

describe('applyDishonoredVulnerable', () => {
  it('does nothing if the sheet was already Dishonored (no re-stacking on every later Condition mark)', () => {
    const sheet = makeSheet(5);
    applyDishonoredVulnerable(sheet, true, 6);
    expect(sheet.Statuses).toEqual([]);
  });

  it('does nothing if the sheet is not (yet) Dishonored', () => {
    const sheet = makeSheet(4);
    applyDishonoredVulnerable(sheet, false, 6);
    expect(sheet.Statuses).toEqual([]);
  });

  it('grants a flat Rank-4 negative Vulnerable Status exactly once, at the false-to-true transition', () => {
    const sheet = makeSheet(5);
    applyDishonoredVulnerable(sheet, false, 6);
    expect(sheet.Statuses).toEqual([expect.objectContaining({ Name: 'Vulnerable', Polarity: 'Negative', Rank: 4 })]);
  });

  it('caps at maxRank same as any other Status', () => {
    const sheet = makeSheet(5);
    applyDishonoredVulnerable(sheet, false, 3);
    expect(sheet.Statuses[0].Rank).toBe(3);
  });
});
