import { describe, expect, it } from 'vitest';
import {
  applyOpposingStatus,
  computeRollBreakdown,
  conditionalRollBonuses,
  giveStatus,
  healStatus,
  healingSurgeAmount,
  resistRollReduction,
  resolveRiskDeath,
} from './engine.js';
import { seedLibrary } from './seedLibrary.js';
import type { CharacterSheet, CharacterStatus, Library } from './types.js';

function makeStatus(overrides: Partial<CharacterStatus> = {}): CharacterStatus {
  return { Id: 'st-1', Name: 'Rattled', Rank: 2, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [], ...overrides };
}

function makeSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    Id: 'sh-1',
    CharacterId: 'ch-1',
    Looks: '',
    Virtues: [
      { VirtueId: 'v-might', Score: 1, ConditionMarked: false },
      { VirtueId: 'v-mettle', Score: 2, ConditionMarked: false },
      { VirtueId: 'v-heart', Score: 0, ConditionMarked: false },
      { VirtueId: 'v-wit', Score: -1, ConditionMarked: true },
      { VirtueId: 'v-guile', Score: 0, ConditionMarked: false },
    ],
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
    Wealth: 0,
    Treasure: 0,
    Hold: 0,
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const library: Library = seedLibrary();

describe('computeRollBreakdown', () => {
  it('includes the base Virtue score alone when nothing else applies', () => {
    const sheet = makeSheet();
    const b = computeRollBreakdown(sheet, 'v-might', library);
    expect(b.Total).toBe(1);
    expect(b.Sources).toEqual([{ Label: 'Might', Value: 1, Kind: 'Virtue' }]);
  });

  it('applies the Condition penalty, floored, when marked', () => {
    const sheet = makeSheet();
    const b = computeRollBreakdown(sheet, 'v-wit', library);
    // -1 base, -2 Condition = -3, floor is -3 so unaffected here
    expect(b.Total).toBe(-3);
    expect(b.Sources.some((s) => s.Kind === 'Condition')).toBe(true);
  });

  it('adds only the single highest helpful and hindering Status', () => {
    const sheet = makeSheet({
      Statuses: [
        makeStatus({ Id: 'st-a', Name: 'Prepared', Rank: 2, Polarity: 'Positive' }),
        makeStatus({ Id: 'st-b', Name: 'Sharp', Rank: 1, Polarity: 'Positive' }),
        makeStatus({ Id: 'st-c', Name: 'Rattled', Rank: 3, Polarity: 'Negative' }),
        makeStatus({ Id: 'st-d', Name: 'Exposed', Rank: 1, Polarity: 'Negative' }),
      ],
    });
    const b = computeRollBreakdown(sheet, 'v-might', library);
    // base 1 + helpful 2 (Prepared) - hindering 3 (Rattled) = 0
    expect(b.Total).toBe(0);
    expect(b.Sources.filter((s) => s.Kind === 'Status')).toHaveLength(2);
  });

  it('includes a Permanent Ability RollBonus targeted at this Virtue', () => {
    const sheet = makeSheet({
      AbilityIds: ['ab-test'],
    });
    const lib: Library = {
      ...library,
      abilities: [
        { Id: 'ab-test', Name: 'Test', RulesText: '', Acquisition: 'Starting', Tags: [], Effects: [{ Kind: 'RollBonus', Value: 2, Duration: 'Permanent', AppliesToVirtueId: 'v-might' }] },
      ],
    };
    const b = computeRollBreakdown(sheet, 'v-might', lib);
    expect(b.Total).toBe(3);
  });

  it('excludes non-Permanent Ability RollBonus from the total, surfacing it as conditional instead', () => {
    const sheet = makeSheet({ AbilityIds: ['ab-martyr'] });
    const b = computeRollBreakdown(sheet, 'v-mettle', library);
    expect(b.Total).toBe(2); // base Mettle only
    const conditional = conditionalRollBonuses(sheet, library, 'v-mettle');
    expect(conditional.length).toBeGreaterThan(0);
  });
});

describe('resistRollReduction', () => {
  it('reduces by the Virtue score on a 7-9', () => {
    expect(resistRollReduction(2, 'Tier2')).toBe(2);
  });

  it('reduces one extra on a 10+', () => {
    expect(resistRollReduction(2, 'Tier3')).toBe(3);
  });

  it('reduces nothing on a miss', () => {
    expect(resistRollReduction(3, 'Tier1')).toBe(0);
  });

  it('floors a negative Virtue score at 0 rather than increasing the incoming Rank', () => {
    expect(resistRollReduction(-2, 'Tier2')).toBe(0);
    expect(resistRollReduction(-2, 'Tier3')).toBe(1);
  });
});

describe('giveStatus', () => {
  it('creates a new Status when none exists', () => {
    const { Statuses, Subdued } = giveStatus([], { Name: 'Bleeding', Polarity: 'Negative', Rank: 3 });
    expect(Statuses).toHaveLength(1);
    expect(Statuses[0]).toMatchObject({ Name: 'Bleeding', Rank: 3, Polarity: 'Negative' });
    expect(Subdued).toBe(false);
  });

  it('stacks onto an existing Status of the same name and polarity', () => {
    const existing = [makeStatus({ Name: 'Bleeding', Rank: 2, Polarity: 'Negative' })];
    const { Statuses } = giveStatus(existing, { Name: 'Bleeding', Polarity: 'Negative', Rank: 2 });
    expect(Statuses[0].Rank).toBe(4);
  });

  it('caps at maxRank and flags Subdued for a Negative Status crossing it', () => {
    const existing = [makeStatus({ Name: 'Bleeding', Rank: 4, Polarity: 'Negative' })];
    const { Statuses, Subdued } = giveStatus(existing, { Name: 'Bleeding', Polarity: 'Negative', Rank: 3 });
    expect(Statuses[0].Rank).toBe(6);
    expect(Subdued).toBe(true);
  });

  it('does not flag Subdued for a Positive Status at the cap', () => {
    const existing = [makeStatus({ Name: 'Inspired', Rank: 4, Polarity: 'Positive' })];
    const { Subdued } = giveStatus(existing, { Name: 'Inspired', Polarity: 'Positive', Rank: 3 });
    expect(Subdued).toBe(false);
  });
});

describe('healStatus', () => {
  it('reduces Rank and removes the Status once it hits 0', () => {
    const existing = [makeStatus({ Id: 'st-1', Rank: 2 })];
    expect(healStatus(existing, 'st-1', 1)[0].Rank).toBe(1);
    expect(healStatus(existing, 'st-1', 5)).toHaveLength(0);
  });
});

describe('applyOpposingStatus', () => {
  it('reduces the opposing Status rank-for-rank, leaving it in place if it survives', () => {
    const existing = [makeStatus({ Id: 'st-hostile', Name: 'Hostile', Rank: 3, Polarity: 'Negative' })];
    const result = applyOpposingStatus(existing, { Name: 'Friendly', Polarity: 'Positive', Rank: 2 }, 'st-hostile');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ Name: 'Hostile', Rank: 1 });
  });

  it('flips to the incoming Status when it overcomes the opposing one', () => {
    const existing = [makeStatus({ Id: 'st-hostile', Name: 'Hostile', Rank: 2, Polarity: 'Negative' })];
    const result = applyOpposingStatus(existing, { Name: 'Friendly', Polarity: 'Positive', Rank: 3 }, 'st-hostile');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ Name: 'Friendly', Rank: 1 });
  });

  it('clears both on an exact match', () => {
    const existing = [makeStatus({ Id: 'st-hostile', Name: 'Hostile', Rank: 2, Polarity: 'Negative' })];
    const result = applyOpposingStatus(existing, { Name: 'Friendly', Polarity: 'Positive', Rank: 2 }, 'st-hostile');
    expect(result).toHaveLength(0);
  });
});

describe('resolveRiskDeath', () => {
  it('drops the Subduing Status to Rank 3 on a 10+', () => {
    expect(resolveRiskDeath('Tier3').SubduingRankAfter).toBe(3);
  });

  it('requires a Scar on a 7-9', () => {
    const r = resolveRiskDeath('Tier2');
    expect(r.RequiresScar).toBe(true);
    expect(r.SubduingRankAfter).toBeNull();
  });

  it('is fatal on a miss', () => {
    const r = resolveRiskDeath('Tier1');
    expect(r.RequiresScar).toBe(false);
    expect(r.SubduingRankAfter).toBeNull();
  });
});

describe('healingSurgeAmount', () => {
  it('adds the reported d6 to Mettle', () => {
    expect(healingSurgeAmount(4, 2)).toBe(6);
  });

  it('never goes negative from a bad d6 report', () => {
    expect(healingSurgeAmount(-1, 2)).toBe(2);
  });
});
