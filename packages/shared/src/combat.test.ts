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
  gambitConditionCost,
  newParticipant,
  nextActor,
  rangeBandDistance,
  repelPushBandsForStatuses,
  shiftRange,
  startNewRound,
  teamUpDramaCost,
  teamUpPartnerCandidates,
  teamUpStartCost,
  ENEMY_TEAM_UP_DRAMA_COST,
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

describe('newParticipant', () => {
  it('builds a PC participant with no enemy stat block', () => {
    const p = newParticipant({ Kind: 'PC', RefId: 'ch-1', Name: 'Ember' });
    expect(p.Kind).toBe('PC');
    expect(p.ActionPointsRemaining).toBe(3);
    expect(p.Stats).toBeUndefined();
    expect(p.Strain).toBeUndefined();
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

  it('skips a Surprised unit, which cannot take a turn in the first round', () => {
    const enemySurprised = base.map((p) => (p.Id === 'e1' ? { ...p, Surprised: true } : p));
    expect(nextActor(enemySurprised, 'Party')).toBe('Party');
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

describe('combatStartRapportDelta (revised V0.6: +1, −1 instead, or 0)', () => {
  const d = (initiatedByHeroes: boolean, sharedGoal: boolean, illPreparedOrOffBalance: boolean) =>
    combatStartRapportDelta({ initiatedByHeroes, sharedGoal, illPreparedOrOffBalance });

  it('marks 1 when the Heroes initiated and all share the Goal', () => {
    expect(d(true, true, false)).toBe(1);
  });

  it('removes 1 when the Heroes did not initiate, whatever else is true', () => {
    expect(d(false, false, false)).toBe(-1);
    expect(d(false, true, false)).toBe(-1);
    expect(d(false, false, true)).toBe(-1);
  });

  it('removes 1 when they begin ill-prepared or off-balance, even having initiated — "instead"', () => {
    expect(d(true, true, true)).toBe(-1);
    expect(d(true, false, true)).toBe(-1);
  });

  it('changes nothing when they initiated without all sharing the Goal', () => {
    expect(d(true, false, false)).toBe(0);
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

  it('ends a Legendary enemy’s one-phase-per-activation guard when it activates (slice 7)', () => {
    const next = beginTurn([unit({ Id: 'boss', PhaseLostSinceActivation: true }), unit({ Id: 'b', PhaseLostSinceActivation: true })], ['boss']);
    expect(next.find((p) => p.Id === 'boss')?.PhaseLostSinceActivation).toBe(false);
    expect(next.find((p) => p.Id === 'b')?.PhaseLostSinceActivation).toBe(true);
  });
});

describe('startNewRound clears surprise after the first round', () => {
  it('clears Surprised for everyone', () => {
    const next = startNewRound([unit({ Id: 'a', Surprised: true }), unit({ Id: 'b', Surprised: false })]);
    expect(next.every((p) => p.Surprised === false || p.Surprised === undefined)).toBe(true);
    expect(next.find((p) => p.Id === 'a')?.Surprised).toBe(false);
  });
});

describe('Prepare duration (V0.7 L5906: next turn returns to normal)', () => {
  it('starting the Prepared unit’s next turn drops its maximum to 3 but keeps the 4 AP it was restored to', () => {
    const [prepared] = endTurn([unit({ ActionPointsRemaining: 0, PrepareNextTurn: true })], 'u', null);
    expect(prepared).toMatchObject({ ActionPointsRemaining: 4, ActionPointsMax: 4 });
    const [started] = beginTurn([prepared], ['u']);
    expect(started).toMatchObject({ ActionPointsRemaining: 4, ActionPointsMax: 3 });
    expect(maxActionPoints(started)).toBe(3);
  });

  it('the end of that next turn restores to 3', () => {
    const [prepared] = endTurn([unit({ ActionPointsRemaining: 0, PrepareNextTurn: true })], 'u', null);
    const [started] = beginTurn([prepared], ['u']);
    const [after] = endTurn([{ ...started, ActionPointsRemaining: 1 }], 'u', null);
    expect(after).toMatchObject({ ActionPointsRemaining: 3, ActionPointsMax: 3 });
  });

  it('never raises a maximum and only touches the named units', () => {
    const next = beginTurn([unit({ Id: 'a', ActionPointsMax: 4 }), unit({ Id: 'b', ActionPointsMax: 4 }), unit({ Id: 'c', ActionPointsMax: 2 })], ['a', 'c']);
    expect(next.map((p) => p.ActionPointsMax)).toEqual([3, 4, 2]);
  });
});

describe('AP restore (V0.7 L5860: AP spent between turns returns at the end of the next turn)', () => {
  it('the end-of-turn refill replaces remaining AP; a Reaction taken afterwards is not given back until the end of the next turn', () => {
    const [afterTurn] = endTurn([unit({ ActionPointsRemaining: 0 })], 'u', null);
    expect(afterTurn.ActionPointsRemaining).toBe(3);
    const reacted = { ...afterTurn, ActionPointsRemaining: afterTurn.ActionPointsRemaining - 1 };
    // Nothing but endTurn refills: a new round does not.
    const [carried] = startNewRound([reacted]);
    expect(carried.ActionPointsRemaining).toBe(2);
    const [afterNext] = endTurn([carried], 'u', null);
    expect(afterNext.ActionPointsRemaining).toBe(3);
  });
});

describe('Team-Up Turns (either side may start one)', () => {
  const hero = (id: string, extra: Partial<CombatParticipant> = {}) => unit({ Id: id, Kind: 'PC', ...extra });
  const foe = (id: string, extra: Partial<CombatParticipant> = {}) => unit({ Id: id, Kind: 'Enemy', ...extra });
  const roster = [hero('h1'), hero('h2'), hero('h3', { Defeated: true }), foe('e1'), foe('e2'), foe('e3', { Defeated: true })];

  it('offers Heroes only living Heroes other than the actor', () => {
    expect(teamUpPartnerCandidates(roster, 'h1').map((p) => p.Id)).toEqual(['h2']);
  });

  it('offers an enemy actor only living enemy units other than itself', () => {
    expect(teamUpPartnerCandidates(roster, 'e1').map((p) => p.Id)).toEqual(['e2']);
  });

  it('offers nothing with no actor picked', () => {
    expect(teamUpPartnerCandidates(roster, null)).toEqual([]);
  });

  it('costs 1 Drama when an enemy starts one, nothing for Heroes', () => {
    expect(teamUpDramaCost(foe('e1'))).toBe(ENEMY_TEAM_UP_DRAMA_COST);
    expect(ENEMY_TEAM_UP_DRAMA_COST).toBe(1);
    expect(teamUpDramaCost(hero('h1'))).toBe(0);
    expect(teamUpDramaCost(undefined)).toBe(0);
  });

  it('charges once, when going from no partner to a partner — not for a swap or a clear', () => {
    expect(teamUpStartCost(foe('e1'), null, 'e2')).toBe(1);
    expect(teamUpStartCost(foe('e1'), 'e2', 'e3')).toBe(0);
    expect(teamUpStartCost(foe('e1'), 'e2', null)).toBe(0);
    expect(teamUpStartCost(hero('h1'), null, 'h2')).toBe(0);
  });

  it('refills AP separately for an enemy pair, and nextActor then hands the turn to the Heroes', () => {
    const next = endTurn([foe('e1', { ActionPointsRemaining: 0 }), foe('e2', { ActionPointsRemaining: 1 }), hero('h1')], 'e1', 'e2');
    expect(next.filter((p) => p.Kind === 'Enemy').map((p) => [p.ActionPointsRemaining, p.HasActedThisRound])).toEqual([[3, true], [3, true]]);
    expect(nextActor(next, 'Enemies')).toBe('Party');
  });
});

