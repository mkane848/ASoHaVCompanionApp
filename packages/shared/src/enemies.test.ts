import { describe, expect, it } from 'vitest';
import type { CombatParticipant, EnemyStatBlock } from './types.js';
import {
  ENEMY_PROFILE_DEFAULTS,
  clearEnemyCondition,
  defaultStatBlock,
  effectiveEnemyVirtues,
  encounterDifficulty,
  enemyStrainBoxes,
  enemyStrainRank,
  enemyVirtueRollHints,
  groupMinionAttack,
  guardedStrain,
  hasFreeStatusSlot,
  inflictEnemyStrain,
  markEnemyCondition,
  negateWithStatus,
  newEnemyParticipant,
} from './enemies.js';

describe('ENEMY_PROFILE_DEFAULTS (the Threat Levels table)', () => {
  it('matches the table row by row', () => {
    expect(ENEMY_PROFILE_DEFAULTS.Minion).toMatchObject({ Threat: 0.5, StatusSlots: 0, ConditionSlots: 1, TypicalAttack: [1, 2] });
    expect(ENEMY_PROFILE_DEFAULTS.Standard).toMatchObject({ Threat: 1, StrainRange: [1, 3], StatusSlots: 1, ConditionSlots: 2, TypicalAttack: [2, 3] });
    expect(ENEMY_PROFILE_DEFAULTS.Elite).toMatchObject({ Threat: 2, StrainRange: [4, 5], StatusSlots: 2, ConditionSlots: 3, TypicalAttack: [2, 4] });
    expect(ENEMY_PROFILE_DEFAULTS.Legendary).toMatchObject({ Threat: 4, StrainBoxes: 5, StatusSlots: 3, ConditionSlots: 5, TypicalAttack: [2, 5] });
  });

  it('starts a ranged Strain value at the top of its range', () => {
    expect(ENEMY_PROFILE_DEFAULTS.Standard.StrainBoxes).toBe(3);
    expect(ENEMY_PROFILE_DEFAULTS.Elite.StrainBoxes).toBe(5);
  });

  it('gives a Minion one box, so any 1 Strain Subdues it', () => {
    expect(ENEMY_PROFILE_DEFAULTS.Minion.StrainBoxes).toBe(1);
  });

  it('gives Last Stand boxes only to a Legendary', () => {
    expect(ENEMY_PROFILE_DEFAULTS.Legendary.LastStandBoxes).toBeGreaterThan(0);
    expect(ENEMY_PROFILE_DEFAULTS.Minion.LastStandBoxes).toBe(0);
    expect(ENEMY_PROFILE_DEFAULTS.Standard.LastStandBoxes).toBe(0);
    expect(ENEMY_PROFILE_DEFAULTS.Elite.LastStandBoxes).toBe(0);
  });
});

describe('defaultStatBlock', () => {
  it('applies the Standard Enemy Rules: Speed 6, Range 1, Guard 0', () => {
    for (const profile of ['Minion', 'Standard', 'Elite', 'Legendary'] as const) {
      expect(defaultStatBlock(profile)).toMatchObject({ Profile: profile, Speed: 6, Range: 1, Guard: 0, Unshakable: false, Attacks: [], Virtues: [] });
    }
  });

  it('carries the profile defaults onto the block', () => {
    expect(defaultStatBlock('Elite')).toMatchObject({ Threat: 2, StrainBoxes: 5, StatusSlots: 2, ConditionSlots: 3, LastStandBoxes: 0 });
    expect(defaultStatBlock('Legendary')).toMatchObject({ Threat: 4, StrainBoxes: 5, StatusSlots: 3, ConditionSlots: 5, LastStandBoxes: 3 });
  });

  it('returns a fresh object each time, so editing one block never touches another', () => {
    const a = defaultStatBlock('Standard');
    const b = defaultStatBlock('Standard');
    a.Attacks.push({ Name: 'x', Target: '', Range: 1, Strain: 1, ResistVirtueIds: [], ConditionVirtueId: null, AdditionalEffect: '', EffectTrigger: 'OnStrain', MisfortuneCost: 0, Notes: '' });
    expect(b.Attacks).toHaveLength(0);
  });
});

describe('encounterDifficulty (Encounter Building)', () => {
  it('reproduces the ruleset’s worked examples for four Heroes', () => {
    expect(encounterDifficulty([4], 4).Band).toBe('Hard');
    expect(encounterDifficulty([4, 0.5, 0.5], 4).Band).toBe('Deadly');
    expect(encounterDifficulty([4, 0.5, 0.5, 0.5, 0.5], 4).Band).toBe('Very Deadly');
  });

  it('reads each band value as its lower bound', () => {
    expect(encounterDifficulty([2], 4).Band).toBe('Easy'); // 0.5
    expect(encounterDifficulty([3], 4).Band).toBe('Medium'); // 0.75
    expect(encounterDifficulty([4], 4).Band).toBe('Hard'); // 1
    expect(encounterDifficulty([5], 4).Band).toBe('Deadly'); // 1.25
    expect(encounterDifficulty([6], 4).Band).toBe('Very Deadly'); // 1.5
    expect(encounterDifficulty([10], 4).Band).toBe('Very Deadly'); // "1.5 or more"
  });

  it('calls anything under Medium Easy, including below 0.5', () => {
    expect(encounterDifficulty([1], 4).Band).toBe('Easy'); // 0.25
    expect(encounterDifficulty([], 4)).toEqual({ TotalThreat: 0, ThreatPerHero: 0, Band: 'Easy' });
  });

  it('reports the total and per-Hero Threat', () => {
    expect(encounterDifficulty([2, 1, 0.5], 3)).toEqual({ TotalThreat: 3.5, ThreatPerHero: 3.5 / 3, Band: 'Hard' });
  });

  it('has no band without any Heroes to divide by', () => {
    expect(encounterDifficulty([4], 0)).toEqual({ TotalThreat: 4, ThreatPerHero: null, Band: null });
  });
});

// ---------- In the fight (revised V0.6, slice 7) — orchestrator truth tables for WP 7A ----------

const X = true;
const _ = false;

function enemy(profile: EnemyStatBlock['Profile'], overrides: Partial<EnemyStatBlock> = {}, extra: Partial<CombatParticipant> = {}): CombatParticipant {
  const p = newEnemyParticipant({ RefId: 'en-1', Name: 'Foe', Stats: { ...defaultStatBlock(profile), ...overrides } });
  return { ...p, ...extra };
}

describe('newEnemyParticipant', () => {
  it('copies the stat block and starts clean', () => {
    const p = enemy('Standard', { StrainBoxes: 3, GambitCharges: 2 });
    expect(p.Kind).toBe('Enemy');
    expect(p.Stats?.Profile).toBe('Standard');
    expect(p.Strain).toEqual([_, _, _]);
    expect(p.StatusNotes).toEqual([]);
    expect(p.ConditionsMarked).toEqual([]);
    expect(p.Crumbled).toBe(false);
    expect(p.Defeated).toBe(false);
    expect(p.GambitCharges).toBe(2);
    expect(p.Range).toBe('Close');
    expect(p.ActionPointsRemaining).toBe(3);
    expect(p.Phase).toBeUndefined();
    expect(p.MinionCount).toBeUndefined();
  });

  it('starts a Legendary in its Opening phase and a Minion group at its size', () => {
    expect(enemy('Legendary').Phase).toBe('Opening');
    expect(enemy('Legendary').PhaseLostSinceActivation).toBe(false);
    expect(newEnemyParticipant({ RefId: '', Name: 'Goblins', Stats: defaultStatBlock('Minion'), MinionCount: 4 }).MinionCount).toBe(4);
    expect(enemy('Minion').MinionCount).toBe(1);
  });

  it('sizes the Strain row from the block', () => {
    expect(enemyStrainBoxes({ ...defaultStatBlock('Elite'), StrainBoxes: 4 })).toBe(4);
    expect(enemy('Legendary').Strain).toHaveLength(5);
  });
});

describe('guardedStrain (Guard, minimum 1; Pierce ignores it)', () => {
  it('subtracts Guard', () => {
    expect(guardedStrain(4, 1, false)).toBe(3);
    expect(guardedStrain(6, 2, false)).toBe(4);
  });
  it('never takes a hit below 1', () => {
    expect(guardedStrain(2, 2, false)).toBe(1);
    expect(guardedStrain(1, 3, false)).toBe(1);
  });
  it('is ignored by Pierce', () => {
    expect(guardedStrain(4, 2, true)).toBe(4);
  });
  it('leaves a hit with no Strain at 0', () => {
    expect(guardedStrain(0, 2, false)).toBe(0);
  });
});

describe('negateWithStatus (fill a Status slot to negate the whole attack)', () => {
  it('fills a free slot with the wound', () => {
    const p = enemy('Standard');
    expect(hasFreeStatusSlot(p)).toBe(true);
    const n = negateWithStatus(p, 'Cracked shield');
    expect(n.StatusNotes).toEqual(['Cracked shield']);
    expect(n.Strain).toEqual(p.Strain);
    expect(hasFreeStatusSlot(n)).toBe(false);
  });
  it('does nothing without a free slot', () => {
    const p = enemy('Minion');
    expect(hasFreeStatusSlot(p)).toBe(false);
    expect(negateWithStatus(p, 'x').StatusNotes).toEqual([]);
  });
});

describe('inflictEnemyStrain (steps 4–5, Minions, Legendary phases)', () => {
  it('marks the box equal to the Strain, then the next open box to its right', () => {
    const p = enemy('Standard', { StrainBoxes: 3 });
    const a = inflictEnemyStrain(p, 2);
    expect(a.Outcome).toBe('Marked');
    expect(a.Participant.Strain).toEqual([_, X, _]);
    const b = inflictEnemyStrain(a.Participant, 2);
    expect(b.Participant.Strain).toEqual([_, X, X]);
  });

  it('Subdues a non-Legendary enemy with no legal box, even with lower boxes open', () => {
    const p = enemy('Standard', { StrainBoxes: 3 }, { Strain: [_, _, X] });
    const r = inflictEnemyStrain(p, 3);
    expect(r.Outcome).toBe('Subdued');
    expect(r.Participant.Defeated).toBe(true);
  });

  it('treats Strain beyond the row as its last box', () => {
    const p = enemy('Standard', { StrainBoxes: 3 });
    expect(inflictEnemyStrain(p, 5).Participant.Strain).toEqual([_, _, X]);
  });

  it('does nothing for 0 Strain or an enemy already Subdued', () => {
    const p = enemy('Standard');
    expect(inflictEnemyStrain(p, 0)).toEqual({ Participant: p, Outcome: 'None' });
    const down = { ...p, Defeated: true };
    expect(inflictEnemyStrain(down, 3).Outcome).toBe('None');
  });

  it('Subdues one Minion per hit, and the group when the last one goes', () => {
    const g = newEnemyParticipant({ RefId: '', Name: 'Goblins', Stats: defaultStatBlock('Minion'), MinionCount: 2 });
    const a = inflictEnemyStrain(g, 1);
    expect(a.Outcome).toBe('MinionSubdued');
    expect(a.Participant.MinionCount).toBe(1);
    expect(a.Participant.Defeated).toBe(false);
    const b = inflictEnemyStrain(a.Participant, 4);
    expect(b.Outcome).toBe('Subdued');
    expect(b.Participant.MinionCount).toBe(0);
    expect(b.Participant.Defeated).toBe(true);
  });

  it('Opening → Bloodied clears every Strain box and Condition, keeps Statuses, and discards the rest', () => {
    const p = enemy('Legendary', {}, { Strain: [X, X, X, X, X], ConditionsMarked: ['v-might'], StatusNotes: ['Burned'] });
    const r = inflictEnemyStrain(p, 3);
    expect(r.Outcome).toBe('PhaseEnded');
    expect(r.Participant.Phase).toBe('Bloodied');
    expect(r.Participant.Strain).toEqual([_, _, _, _, _]);
    expect(r.Participant.ConditionsMarked).toEqual([]);
    expect(r.Participant.StatusNotes).toEqual(['Burned']);
    expect(r.Participant.PhaseLostSinceActivation).toBe(true);
    expect(r.Participant.Defeated).toBe(false);
  });

  it('loses no more than one phase between activations: further unmarkable Strain is discarded', () => {
    const p = enemy('Legendary', {}, { Phase: 'Bloodied', PhaseLostSinceActivation: true, Strain: [_, _, _, _, X] });
    const r = inflictEnemyStrain(p, 5);
    expect(r.Outcome).toBe('Discarded');
    expect(r.Participant).toEqual(p);
  });

  it('Bloodied → Last Stand (N) clears Conditions and the N highest-numbered marked boxes', () => {
    const p = enemy('Legendary', { LastStandBoxes: 3 }, { Phase: 'Bloodied', Strain: [X, X, X, X, X], ConditionsMarked: ['v-wit'], Crumbled: true });
    const r = inflictEnemyStrain(p, 2);
    expect(r.Outcome).toBe('PhaseEnded');
    expect(r.Participant.Phase).toBe('LastStand');
    expect(r.Participant.Strain).toEqual([X, X, _, _, _]);
    expect(r.Participant.ConditionsMarked).toEqual([]);
    expect(r.Participant.Crumbled).toBe(false);
    expect(r.Participant.PhaseLostSinceActivation).toBe(true);
  });

  it('clears only marked boxes for Last Stand, highest first, on a sparse row', () => {
    const p = enemy('Legendary', { LastStandBoxes: 2 }, { Phase: 'Bloodied', Strain: [X, _, X, _, X] });
    expect(inflictEnemyStrain(p, 5).Participant.Strain).toEqual([X, _, _, _, _]);
  });

  it('cannot lose Last Stand until after its next activation, then is Subdued', () => {
    const entered = enemy('Legendary', {}, { Phase: 'LastStand', PhaseLostSinceActivation: true, Strain: [X, X, X, X, X] });
    expect(inflictEnemyStrain(entered, 1).Outcome).toBe('Discarded');
    const later = { ...entered, PhaseLostSinceActivation: false };
    const r = inflictEnemyStrain(later, 1);
    expect(r.Outcome).toBe('Subdued');
    expect(r.Participant.Defeated).toBe(true);
  });
});

describe('enemyStrainRank (Repel pushes by it)', () => {
  it('is the highest marked box', () => {
    expect(enemyStrainRank(enemy('Elite', {}, { Strain: [_, X, _, X, _] }))).toBe(4);
    expect(enemyStrainRank(enemy('Elite'))).toBe(0);
  });
});

describe('markEnemyCondition / clearEnemyCondition (Crumble, Unshakable)', () => {
  it('Crumbles on the final available Condition', () => {
    const p = enemy('Standard', { ConditionSlots: 2 });
    const a = markEnemyCondition(p, 'v-might');
    expect(a.Crumbled).toBe(false);
    expect(a.Participant.ConditionsMarked).toEqual(['v-might']);
    const b = markEnemyCondition(a.Participant, 'v-wit');
    expect(b.Crumbled).toBe(true);
    expect(b.Participant.Crumbled).toBe(true);
  });

  it('Crumbles a Minion on any Condition', () => {
    expect(markEnemyCondition(enemy('Minion'), 'v-heart').Crumbled).toBe(true);
  });

  it('does nothing to an Unshakable enemy', () => {
    const p = enemy('Elite', { Unshakable: true });
    const r = markEnemyCondition(p, 'v-might');
    expect(r.Crumbled).toBe(false);
    expect(r.Participant).toEqual(p);
  });

  it('does nothing when that Condition is already marked', () => {
    const p = enemy('Elite', {}, { ConditionsMarked: ['v-might'] });
    expect(markEnemyCondition(p, 'v-might').Participant.ConditionsMarked).toEqual(['v-might']);
  });

  it('clearing one lifts a Crumble', () => {
    const p = enemy('Standard', { ConditionSlots: 1 }, { ConditionsMarked: ['v-might'], Crumbled: true });
    const c = clearEnemyCondition(p, 'v-might');
    expect(c.ConditionsMarked).toEqual([]);
    expect(c.Crumbled).toBe(false);
  });
});

describe('effectiveEnemyVirtues (a marked Condition degrades its Virtue)', () => {
  const stats: EnemyStatBlock = {
    ...defaultStatBlock('Elite'),
    Virtues: [
      { VirtueId: 'v-might', Rating: 2 },
      { VirtueId: 'v-mettle', Rating: 0 },
      { VirtueId: 'v-wit', Rating: -1 },
    ],
  };
  it('leaves unmarked Virtues alone', () => {
    expect(effectiveEnemyVirtues(stats, [])).toEqual(stats.Virtues);
  });
  it('Strong (+ or ++) → Neutral, Neutral → Weak, Weak stays', () => {
    expect(effectiveEnemyVirtues(stats, ['v-might', 'v-mettle', 'v-wit'])).toEqual([
      { VirtueId: 'v-might', Rating: 0 },
      { VirtueId: 'v-mettle', Rating: -1 },
      { VirtueId: 'v-wit', Rating: -1 },
    ]);
  });
  it('makes an unlisted (Neutral) Virtue Weak, after the listed ones', () => {
    expect(effectiveEnemyVirtues(stats, ['v-guile'])).toEqual([...stats.Virtues, { VirtueId: 'v-guile', Rating: -1 }]);
  });
});

describe('enemyVirtueRollHints (one Bane per +, one Boon per −)', () => {
  it('lists every non-Neutral Virtue after Conditions', () => {
    const p = enemy('Elite', { Virtues: [{ VirtueId: 'v-might', Rating: 2 }, { VirtueId: 'v-wit', Rating: -1 }, { VirtueId: 'v-heart', Rating: 0 }] });
    expect(enemyVirtueRollHints(p)).toEqual([
      { VirtueId: 'v-might', Rating: 2, Banes: 2, Boons: 0 },
      { VirtueId: 'v-wit', Rating: -1, Banes: 0, Boons: 1 },
    ]);
    const shaken = { ...p, ConditionsMarked: ['v-might'] };
    expect(enemyVirtueRollHints(shaken)).toEqual([{ VirtueId: 'v-wit', Rating: -1, Banes: 0, Boons: 1 }]);
  });
});

describe('groupMinionAttack (combined, at most 5)', () => {
  it('adds the Minions’ Strain and caps it at 5', () => {
    expect(groupMinionAttack(1, 3)).toBe(3);
    expect(groupMinionAttack(2, 4)).toBe(5);
    expect(groupMinionAttack(1, 0)).toBe(0);
  });
});
