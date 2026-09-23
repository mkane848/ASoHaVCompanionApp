import { emptyMarks, markRank, statusRank } from './engine.js';
import { describe, expect, it } from 'vitest';
import {
  beginTurn,
  braceForcedMovement,
  engageStrain,
  maxActionPoints,
  repeatedAttackShape,
  PREPARED_ACTION_POINTS,
  combatStartRapportDelta,
  endTurn,
  isEnemyUnstable,
  applyToughness,
  engageBaseRank,
  firstToActFromInitiative,
  firstToActFromSurprise,
  gambitConditionCost,
  isEnemyDefeated,
  markEnemyStrain,
  newParticipant,
  nextActor,
  rangeBandDistance,
  repelPushBandsForEnemy,
  repelPushBandsForStatuses,
  resistForcedMovementBands,
  shiftRange,
  startNewRound,
} from './combat.js';
import type { CombatParticipant } from './types.js';

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
    expect(applyToughness(3, 'Tier1', 'Melee', 'Heavy')).toBe(2); // Tier1 has no lower tier
  });

  it('leaves a non-positive base Rank alone', () => {
    expect(applyToughness(0, 'Tier1', 'Ranged', 'Heavy')).toBe(0);
  });
});

describe('markEnemyStrain', () => {
  it('creates a new named track when none exists', () => {
    const next = markEnemyStrain([], 'Hurt', 3, 5);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ Name: 'Hurt' });
    expect(statusRank(next[0])).toBe(3);
  });

  it('marks the next empty box right rather than summing on an existing track', () => {
    const once = markEnemyStrain([], 'Hurt', 2, 5);
    const twice = markEnemyStrain(once, 'Hurt', 2, 5);
    expect(twice).toHaveLength(1);
    expect(statusRank(twice[0])).toBe(3);
  });

  it('matches an existing track case-insensitively', () => {
    const once = markEnemyStrain([], 'hurt', 1, 5);
    const twice = markEnemyStrain(once, 'Hurt', 1, 5);
    expect(twice).toHaveLength(1);
  });

  it('is a no-op for a non-positive amount', () => {
    expect(markEnemyStrain([], 'Hurt', 0, 5)).toEqual([]);
  });
});

describe('isEnemyDefeated', () => {
  it('is false with no matching track at/over its Limit', () => {
    expect(isEnemyDefeated([{ Name: 'Hurt', Marks: markRank(emptyMarks(), 2) }], [{ StatusName: 'Hurt', Limit: 4 }])).toBe(false);
  });

  it('is true once any one Limit is reached', () => {
    expect(isEnemyDefeated([{ Name: 'Hurt', Marks: markRank(emptyMarks(), 4) }], [{ StatusName: 'Hurt', Limit: 4 }, { StatusName: 'Scared', Limit: 3 }])).toBe(true);
  });

  it('matches track names case-insensitively', () => {
    expect(isEnemyDefeated([{ Name: 'hurt', Marks: markRank(emptyMarks(), 5) }], [{ StatusName: 'Hurt', Limit: 4 }])).toBe(true);
  });

  it('is false with no tracks or no Limits', () => {
    expect(isEnemyDefeated(undefined, [{ StatusName: 'Hurt', Limit: 4 }])).toBe(false);
    expect(isEnemyDefeated([{ Name: 'Hurt', Marks: markRank(emptyMarks(), 5) }], [])).toBe(false);
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
    expect(p.IsBoss).toBeUndefined();
    expect(p.GambitCharges).toBeUndefined();
  });

  it('carries IsBoss/GambitCharges for a Boss Enemy', () => {
    const p = newParticipant({ Kind: 'Enemy', RefId: 'en-grizza', Name: 'Grizza', IsBoss: true, GambitCharges: 4 });
    expect(p.IsBoss).toBe(true);
    expect(p.GambitCharges).toBe(4);
  });
});

describe('startNewRound', () => {
  // AP no longer resets here (slice 5) — it recharges per-unit at the end of that unit's own
  // turn (`endTurn`), not all at once at the round boundary. This clears only the acted flag so
  // `nextActor` can alternate through the roster again.
  it('clears the acted flag for everyone without touching AP', () => {
    const participants = [
      { Id: 'a', Kind: 'PC' as const, RefId: 'ch-1', Name: 'A', Range: 'Close' as const, ActionPointsRemaining: 0, HasActedThisRound: true },
    ];
    const next = startNewRound(participants);
    expect(next[0].ActionPointsRemaining).toBe(0);
    expect(next[0].HasActedThisRound).toBe(false);
  });
});

describe('endTurn', () => {
  const participants: CombatParticipant[] = [
    { Id: 'a', Kind: 'PC', RefId: 'ch-1', Name: 'A', Range: 'Close', ActionPointsRemaining: 0, HasActedThisRound: false },
    { Id: 'b', Kind: 'PC', RefId: 'ch-2', Name: 'B', Range: 'Close', ActionPointsRemaining: 1, HasActedThisRound: false },
    { Id: 'c', Kind: 'Enemy', RefId: '', Name: 'C', Range: 'Close', ActionPointsRemaining: 2, HasActedThisRound: false },
  ];

  it('recharges AP and marks acted only for the acting participant', () => {
    const next = endTurn(participants, 'a', null);
    expect(next.find((p) => p.Id === 'a')).toMatchObject({ ActionPointsRemaining: 3, HasActedThisRound: true });
    expect(next.find((p) => p.Id === 'b')).toMatchObject({ ActionPointsRemaining: 1, HasActedThisRound: false });
    expect(next.find((p) => p.Id === 'c')).toMatchObject({ ActionPointsRemaining: 2, HasActedThisRound: false });
  });

  it('also recharges the paired participant when two units acted together', () => {
    const next = endTurn(participants, 'a', 'b');
    expect(next.find((p) => p.Id === 'a')).toMatchObject({ ActionPointsRemaining: 3, HasActedThisRound: true });
    expect(next.find((p) => p.Id === 'b')).toMatchObject({ ActionPointsRemaining: 3, HasActedThisRound: true });
    expect(next.find((p) => p.Id === 'c')).toMatchObject({ ActionPointsRemaining: 2, HasActedThisRound: false });
  });
});

describe('nextActor', () => {
  const base: CombatParticipant[] = [
    { Id: 'p1', Kind: 'PC', RefId: 'ch-1', Name: 'P1', Range: 'Close', ActionPointsRemaining: 3, HasActedThisRound: false },
    { Id: 'p2', Kind: 'PC', RefId: 'ch-2', Name: 'P2', Range: 'Close', ActionPointsRemaining: 3, HasActedThisRound: false },
    { Id: 'e1', Kind: 'Enemy', RefId: '', Name: 'E1', Range: 'Close', ActionPointsRemaining: 3, HasActedThisRound: false },
  ];

  it('returns null with no ActingSide set yet', () => {
    expect(nextActor(base, null)).toBeNull();
  });

  it('suggests the other side when it still has an eligible unit', () => {
    expect(nextActor(base, 'Party')).toBe('Enemies');
    expect(nextActor(base, 'Enemies')).toBe('Party');
  });

  it('suggests the same side again once the other side is out of eligible units (leftovers act consecutively)', () => {
    const enemyActed = base.map((p) => (p.Id === 'e1' ? { ...p, HasActedThisRound: true } : p));
    expect(nextActor(enemyActed, 'Party')).toBe('Party');
  });

  it('returns null once neither side has an eligible unit left', () => {
    const allActed = base.map((p) => ({ ...p, HasActedThisRound: true }));
    expect(nextActor(allActed, 'Party')).toBeNull();
  });

  it('ignores a Defeated unit as ineligible', () => {
    const enemyDefeated = base.map((p) => (p.Id === 'e1' ? { ...p, Defeated: true } : p));
    expect(nextActor(enemyDefeated, 'Party')).toBe('Party');
  });
});

describe('repelPushBandsForEnemy', () => {
  it('is 0 with no Strain marked on any track', () => {
    expect(repelPushBandsForEnemy([{ Marks: emptyMarks() }])).toBe(0);
    expect(repelPushBandsForEnemy(undefined)).toBe(0);
  });

  it('is the highest value across its Strain tracks', () => {
    expect(
      repelPushBandsForEnemy([
        { Marks: markRank(emptyMarks(), 2) },
        { Marks: markRank(emptyMarks(), 5) },
      ]),
    ).toBe(5);
  });
});

describe('repelPushBandsForStatuses', () => {
  it('is 0 with no Status held', () => {
    expect(repelPushBandsForStatuses([])).toBe(0);
    expect(repelPushBandsForStatuses(undefined)).toBe(0);
  });

  it('is the severity of the highest Status: Minor 1 / Major 2 / Severe 3', () => {
    expect(repelPushBandsForStatuses([{ Severity: 'Minor' }])).toBe(1);
    expect(repelPushBandsForStatuses([{ Severity: 'Minor' }, { Severity: 'Major' }])).toBe(2);
    expect(repelPushBandsForStatuses([{ Severity: 'Severe' }, { Severity: 'Minor' }])).toBe(3);
  });
});

describe('resistForcedMovementBands', () => {
  it('reduces the push by Mettle, floored at 0', () => {
    expect(resistForcedMovementBands(3, 1)).toBe(2);
    expect(resistForcedMovementBands(2, 5)).toBe(0);
  });

  it('never turns a push into a pull, and a negative Mettle never increases it', () => {
    expect(resistForcedMovementBands(3, -2)).toBe(3);
  });
});

describe('combatStartRapportDelta', () => {
  it('gives +1 for initiating, +2 with a shared goal', () => {
    expect(combatStartRapportDelta({ initiatedByHeroes: true, sharedGoal: false, illPreparedOrOffBalance: false })).toBe(1);
    expect(combatStartRapportDelta({ initiatedByHeroes: true, sharedGoal: true, illPreparedOrOffBalance: false })).toBe(2);
  });

  it('gives -1 only when not initiated and ill-prepared/off-balance', () => {
    expect(combatStartRapportDelta({ initiatedByHeroes: false, sharedGoal: false, illPreparedOrOffBalance: true })).toBe(-1);
  });

  it('gives no change for a fair fight the Heroes did not start', () => {
    expect(combatStartRapportDelta({ initiatedByHeroes: false, sharedGoal: false, illPreparedOrOffBalance: false })).toBe(0);
  });

  it('shared goal only matters when the Heroes initiated', () => {
    expect(combatStartRapportDelta({ initiatedByHeroes: false, sharedGoal: true, illPreparedOrOffBalance: false })).toBe(0);
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

describe('firstToActFromSurprise', () => {
  it('gives the Enemies the first turn when the Party is surprised', () => {
    expect(firstToActFromSurprise('Party')).toBe('Enemies');
  });

  it('gives the Party the first turn when the Enemies are surprised', () => {
    expect(firstToActFromSurprise('Enemies')).toBe('Party');
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

describe('isEnemyUnstable', () => {
  const limits = [{ StatusName: 'Hurt', Limit: 4 }];

  it('is false below half the Limit', () => {
    expect(isEnemyUnstable([{ Name: 'Hurt', Marks: markRank(emptyMarks(), 1) }], limits)).toBe(false);
  });

  it('is true at half the Limit, rounded up', () => {
    expect(isEnemyUnstable([{ Name: 'Hurt', Marks: markRank(emptyMarks(), 2) }], limits)).toBe(true);
    // An odd Limit rounds up: half of 5 is 3, not 2.
    expect(isEnemyUnstable([{ Name: 'Scared', Marks: markRank(emptyMarks(), 2) }], [{ StatusName: 'Scared', Limit: 5 }])).toBe(false);
    expect(isEnemyUnstable([{ Name: 'Scared', Marks: markRank(emptyMarks(), 3) }], [{ StatusName: 'Scared', Limit: 5 }])).toBe(true);
  });

  it('is false with no Statuses or no Limits', () => {
    expect(isEnemyUnstable(undefined, limits)).toBe(false);
    expect(isEnemyUnstable([{ Name: 'Hurt', Marks: markRank(emptyMarks(), 4) }], [])).toBe(false);
  });
});

// ---------- Revised V0.6 slice 6: the Combat loop ----------

function unit(over: Partial<CombatParticipant> = {}): CombatParticipant {
  return { Id: 'u', Kind: 'PC', RefId: 'ch-1', Name: 'U', Range: 'Close', ActionPointsRemaining: 3, HasActedThisRound: false, ...over };
}

describe('engageStrain (revised Engage values)', () => {
  it('deals 6/4/2 in Melee', () => {
    expect(engageStrain('Melee', 'Tier3')).toBe(6);
    expect(engageStrain('Melee', 'Tier2')).toBe(4);
    expect(engageStrain('Melee', 'Tier1')).toBe(2);
  });

  it('deals 5/3/1 at Range', () => {
    expect(engageStrain('Ranged', 'Tier3')).toBe(5);
    expect(engageStrain('Ranged', 'Tier2')).toBe(3);
    expect(engageStrain('Ranged', 'Tier1')).toBe(1);
  });
});

describe('repeatedAttackShape (the Repeated Attacks table, row by row)', () => {
  it('Advantage: Advantage, Normal, Disadvantage, then Disadvantage', () => {
    expect(repeatedAttackShape('Advantage', 0)).toBe('Advantage');
    expect(repeatedAttackShape('Advantage', 1)).toBe('Normal');
    expect(repeatedAttackShape('Advantage', 2)).toBe('Disadvantage');
    expect(repeatedAttackShape('Advantage', 5)).toBe('Disadvantage');
  });

  it('Normal: Normal, Disadvantage, Double Disadvantage, then Double Disadvantage', () => {
    expect(repeatedAttackShape('Normal', 0)).toBe('Normal');
    expect(repeatedAttackShape('Normal', 1)).toBe('Disadvantage');
    expect(repeatedAttackShape('Normal', 2)).toBe('DoubleDisadvantage');
    expect(repeatedAttackShape('Normal', 5)).toBe('DoubleDisadvantage');
  });

  it('Disadvantage: Disadvantage, Double Disadvantage, then Double Disadvantage', () => {
    expect(repeatedAttackShape('Disadvantage', 0)).toBe('Disadvantage');
    expect(repeatedAttackShape('Disadvantage', 1)).toBe('DoubleDisadvantage');
    expect(repeatedAttackShape('Disadvantage', 2)).toBe('DoubleDisadvantage');
  });

  it('never gets worse than Double Disadvantage', () => {
    expect(repeatedAttackShape('DoubleDisadvantage', 0)).toBe('DoubleDisadvantage');
    expect(repeatedAttackShape('DoubleDisadvantage', 3)).toBe('DoubleDisadvantage');
  });
});

describe('braceForcedMovement (Brace, minimum 1)', () => {
  it('reduces a push by Mettle', () => {
    expect(braceForcedMovement(4, 2)).toBe(2);
  });

  it('reduces by at least 1, even at Mettle 0 or below', () => {
    expect(braceForcedMovement(3, 0)).toBe(2);
    expect(braceForcedMovement(3, -1)).toBe(2);
  });

  it('never turns a push into a pull', () => {
    expect(braceForcedMovement(2, 5)).toBe(0);
    expect(braceForcedMovement(1, 0)).toBe(0);
  });
});

describe('endTurn with Prepare, Repeated Attacks and Halt', () => {
  it('refills to 4 after Prepare, records the maximum, and clears the flag', () => {
    const [next] = endTurn([unit({ ActionPointsRemaining: 0, PrepareNextTurn: true })], 'u', null);
    expect(next).toMatchObject({ ActionPointsRemaining: PREPARED_ACTION_POINTS, ActionPointsMax: 4, PrepareNextTurn: false, HasActedThisRound: true });
  });

  it('lasts one turn: the turn after refills to 3 again', () => {
    const [prepared] = endTurn([unit({ ActionPointsRemaining: 0, PrepareNextTurn: true })], 'u', null);
    const [after] = endTurn([{ ...prepared, ActionPointsRemaining: 0 }], 'u', null);
    expect(after).toMatchObject({ ActionPointsRemaining: 3, ActionPointsMax: 3 });
  });

  it('zeroes the Repeated Attacks count and clears Halted', () => {
    const [next] = endTurn([unit({ StrainMovesSinceRefresh: 2, Halted: true })], 'u', null);
    expect(next.StrainMovesSinceRefresh).toBe(0);
    expect(next.Halted).toBe(false);
  });

  it('changes only the acting unit and its Team-Up partner', () => {
    const others = [unit({ Id: 'a', PrepareNextTurn: true }), unit({ Id: 'b', StrainMovesSinceRefresh: 1 }), unit({ Id: 'c', StrainMovesSinceRefresh: 2, ActionPointsRemaining: 1 })];
    const next = endTurn(others, 'a', 'b');
    expect(next.find((p) => p.Id === 'a')?.ActionPointsRemaining).toBe(4);
    expect(next.find((p) => p.Id === 'b')?.StrainMovesSinceRefresh).toBe(0);
    expect(next.find((p) => p.Id === 'c')).toMatchObject({ StrainMovesSinceRefresh: 2, ActionPointsRemaining: 1, HasActedThisRound: false });
  });
});

describe('maxActionPoints', () => {
  it('is 3 by default and follows ActionPointsMax', () => {
    expect(maxActionPoints(unit())).toBe(3);
    expect(maxActionPoints(unit({ ActionPointsMax: 4 }))).toBe(4);
  });
});

describe('beginTurn (Fortify ends at the beginning of your next turn)', () => {
  it('clears Fortified on the named units only', () => {
    const next = beginTurn([unit({ Id: 'a', Fortified: true }), unit({ Id: 'b', Fortified: true })], ['a']);
    expect(next.find((p) => p.Id === 'a')?.Fortified).toBe(false);
    expect(next.find((p) => p.Id === 'b')?.Fortified).toBe(true);
  });
});

describe('startNewRound clears surprise after the first round', () => {
  it('clears Surprised for everyone', () => {
    const next = startNewRound([unit({ Id: 'a', Surprised: true }), unit({ Id: 'b', Surprised: false })]);
    expect(next.every((p) => p.Surprised === false || p.Surprised === undefined)).toBe(true);
    expect(next.find((p) => p.Id === 'a')?.Surprised).toBe(false);
  });
});

