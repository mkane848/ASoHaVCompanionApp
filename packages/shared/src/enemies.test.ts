import { describe, expect, it } from 'vitest';
import { ENEMY_PROFILE_DEFAULTS, defaultStatBlock, encounterDifficulty } from './enemies.js';

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
