import { describe, expect, it } from 'vitest';
import {
  advanceHealingTrack,
  computeRollBreakdown,
  downgradeStatuses,
  emptyMarks,
  highestSeverityStatus,
  holdGrantForTier,
  isSubdued,
  isUnstable,
  markRank,
  markStrain,
  reduceRank,
  resistRollReduction,
  statusAbsorb,
  statusPenalty,
  statusRank,
  statusSeverityCounts,
  strainExhausted,
  takeStatus,
} from './engine.js';
import { seedLibrary } from './seedLibrary.js';
import type { CharacterSheet, CharacterStatus, Library, StatusSeverity } from './types.js';

function makeStatus(severity: StatusSeverity, overrides: Partial<CharacterStatus> = {}): CharacterStatus {
  return {
    Id: 'st-1',
    Severity: severity,
    Name: 'Twisted Ankle',
    Description: '',
    ...overrides,
  };
}

/** `[_, X, _, X, _]` shorthand: `row(2, 4)` marks boxes 2 and 4. */
function row(...boxes: number[]): boolean[] {
  return boxes.reduce((m, b) => markRank(m, b), emptyMarks());
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
    Strain: emptyMarks(),
    Statuses: [],
    HealingTrack: 0,
    Boons: [],
    Banes: [],
    Armor: [],
    Motifs: [],
    Load: { Tier: 'Normal', LatchedUntilCamp: false },
    Items: [],
    Advancement: { History: [] },
    Improvements: [],
    Level: 0,
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

  it('surfaces the highest-severity Status separately from Total, never folding it in', () => {
    const sheet = makeSheet({
      Statuses: [makeStatus('Minor', { Id: 'st-a', Name: 'Bruised' }), makeStatus('Severe', { Id: 'st-b', Name: 'Shattered Psyche' })],
    });
    const b = computeRollBreakdown(sheet, 'v-might', library);
    expect(b.Total).toBe(1); // base Might only
    expect(b.StatusPenalty).toEqual({ Status: sheet.Statuses[1], Penalty: { Severity: 'Severe', Label: 'roll 1d6 instead of 2d6' } });
  });

  it('is null when the sheet holds no Statuses', () => {
    const b = computeRollBreakdown(makeSheet(), 'v-might', library);
    expect(b.StatusPenalty).toBeNull();
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

  it('floors a negative Virtue score at 0 rather than increasing the incoming amount', () => {
    expect(resistRollReduction(-2, 'Tier2')).toBe(0);
    expect(resistRollReduction(-2, 'Tier3')).toBe(1);
  });
});

describe('holdGrantForTier', () => {
  it('returns the grant for the reported tier', () => {
    expect(holdGrantForTier({ HoldGrant: { Tier3: 3, Tier2: 1 } }, 'Tier3')).toBe(3);
    expect(holdGrantForTier({ HoldGrant: { Tier3: 3, Tier2: 1 } }, 'Tier2')).toBe(1);
  });

  it('is 0 for a tier the Move has no grant for', () => {
    expect(holdGrantForTier({ HoldGrant: { Tier3: 3 } }, 'Tier1')).toBe(0);
  });

  it('is 0 for a Move with no HoldGrant at all', () => {
    expect(holdGrantForTier({}, 'Tier3')).toBe(0);
  });
});

describe('box-row primitives', () => {
  describe('statusRank', () => {
    it('is the highest marked box, not a count of marks', () => {
      // The whole reason a box row isn't a plain integer: this row has two marks but reads as 4.
      expect(statusRank({ Marks: row(2, 4) })).toBe(4);
      expect(statusRank({ Marks: row(1, 2, 3) })).toBe(3);
    });

    it('is 0 for an empty row', () => {
      expect(statusRank({ Marks: emptyMarks() })).toBe(0);
    });
  });

  describe('markRank', () => {
    it('marks the named box when it is free', () => {
      expect(statusRank({ Marks: markRank(emptyMarks(), 3) })).toBe(3);
    });

    it('lands on the next empty box to the RIGHT when the named box is taken', () => {
      const once = markRank(emptyMarks(), 2);
      const twice = markRank(once, 2);
      expect(statusRank({ Marks: twice })).toBe(3);
      expect(twice.slice(0, 4)).toEqual([false, true, true, false]);
    });

    it('skips over a run of marked boxes to the first free one', () => {
      const marks = markRank(row(2, 3, 4), 2);
      expect(statusRank({ Marks: marks })).toBe(5);
    });

    it('returns the row unchanged when everything from n rightwards is already marked', () => {
      const saturated = row(3, 4, 5);
      expect(markRank(saturated, 3)).toEqual(saturated);
    });

    it('is a no-op for an out-of-range box', () => {
      expect(markRank(emptyMarks(), 0)).toEqual(emptyMarks());
      expect(markRank(emptyMarks(), 99)).toEqual(emptyMarks());
    });
  });

  describe('reduceRank', () => {
    it('clears from the highest marked box down, not the lowest', () => {
      const reduced = reduceRank(row(1, 2, 4), 1);
      expect(statusRank({ Marks: reduced })).toBe(2);
      expect(reduced.slice(0, 4)).toEqual([true, true, false, false]);
    });

    it('empties the row when reduced past the bottom', () => {
      expect(statusRank({ Marks: reduceRank(row(1, 3), 5) })).toBe(0);
    });

    it('is a no-op for zero or negative amounts', () => {
      const marks = row(2, 4);
      expect(reduceRank(marks, 0)).toEqual(marks);
      expect(reduceRank(marks, -3)).toEqual(marks);
    });
  });
});

describe('markStrain / strainExhausted', () => {
  it('marks the box matching the incoming amount', () => {
    expect(statusRank({ Marks: markStrain(emptyMarks(), 3) })).toBe(3);
  });

  it('is a no-op for a non-positive amount', () => {
    const marks = row(2);
    expect(markStrain(marks, 0)).toBe(marks);
  });

  it('reports exhausted only when no box at or above the amount is free', () => {
    expect(strainExhausted(row(1, 2, 3, 4, 5), 2)).toBe(true);
    expect(strainExhausted(row(1, 2, 3, 4), 2)).toBe(false); // box 5 still free
    expect(strainExhausted(emptyMarks(), 0)).toBe(false);
  });
});

describe('statusAbsorb', () => {
  it('matches V0.6\'s table: 2 / 4 / 6', () => {
    expect(statusAbsorb('Minor')).toBe(2);
    expect(statusAbsorb('Major')).toBe(4);
    expect(statusAbsorb('Severe')).toBe(6);
  });
});

describe('statusPenalty', () => {
  it('matches V0.6\'s table: -1 / Disadvantage / roll 1d6', () => {
    expect(statusPenalty('Minor').Label).toBe('-1');
    expect(statusPenalty('Major').Label).toBe('Disadvantage');
    expect(statusPenalty('Severe').Label).toBe('roll 1d6 instead of 2d6');
  });
});

describe('highestSeverityStatus', () => {
  it('picks Severe over Major over Minor', () => {
    const severe = makeStatus('Severe', { Id: 'st-severe' });
    const statuses = [makeStatus('Minor', { Id: 'st-minor' }), makeStatus('Major', { Id: 'st-major' }), severe];
    expect(highestSeverityStatus(statuses)).toBe(severe);
  });

  it('is null for an empty list', () => {
    expect(highestSeverityStatus([])).toBeNull();
  });
});

describe('takeStatus', () => {
  it('appends a new, trimmed Status', () => {
    const next = takeStatus([], { Severity: 'Major', Name: '  Broken Arm  ', Description: '  Snapped in the fall.  ' });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ Severity: 'Major', Name: 'Broken Arm', Description: 'Snapped in the fall.' });
  });
});

describe('statusSeverityCounts', () => {
  it('counts each severity independently', () => {
    const statuses = [makeStatus('Minor'), makeStatus('Minor', { Id: 'st-2' }), makeStatus('Major', { Id: 'st-3' })];
    expect(statusSeverityCounts(statuses)).toEqual({ Minor: 2, Major: 1, Severe: 0 });
  });
});

describe('downgradeStatuses', () => {
  const caps = { Minor: 3, Major: 2, Severe: 1 };

  it('drops each Status one severity when a lower slot is free', () => {
    const statuses = [makeStatus('Severe', { Id: 'st-1' }), makeStatus('Major', { Id: 'st-2' })];
    const next = downgradeStatuses(statuses, caps);
    expect(next.find((s) => s.Id === 'st-1')?.Severity).toBe('Major');
    expect(next.find((s) => s.Id === 'st-2')?.Severity).toBe('Minor');
  });

  it('leaves a Status in place when the lower slot is already full', () => {
    // Two Majors already occupy both Major slots — a Severe downgrading in has nowhere to go.
    const statuses = [
      makeStatus('Severe', { Id: 'st-1' }),
      makeStatus('Major', { Id: 'st-2' }),
      makeStatus('Major', { Id: 'st-3' }),
    ];
    const next = downgradeStatuses(statuses, caps);
    expect(next.find((s) => s.Id === 'st-1')?.Severity).toBe('Severe');
  });

  it('leaves a Minor Status untouched — nowhere lower to go', () => {
    const statuses = [makeStatus('Minor', { Id: 'st-1' })];
    expect(downgradeStatuses(statuses, caps)[0].Severity).toBe('Minor');
  });

  it('does not let two downgrading Statuses double-book the same freed slot in one pass', () => {
    // Both Severes want the single Major slot the doc's "in any order you want" implies is a
    // real choice — checked against the *starting* counts, so only one can take it.
    const statuses = [makeStatus('Severe', { Id: 'st-1' }), makeStatus('Severe', { Id: 'st-2' })];
    const next = downgradeStatuses(statuses, { Minor: 3, Major: 1, Severe: 2 });
    const severities = next.map((s) => s.Severity).sort();
    expect(severities).toEqual(['Major', 'Severe']);
  });
});

describe('isUnstable', () => {
  it('is true while holding any Major or Severe Status', () => {
    expect(isUnstable([makeStatus('Major')])).toBe(true);
    expect(isUnstable([makeStatus('Severe')])).toBe(true);
  });

  it('is false with only Minor Statuses, or none at all', () => {
    expect(isUnstable([makeStatus('Minor')])).toBe(false);
    expect(isUnstable([])).toBe(false);
  });
});

describe('isSubdued', () => {
  const caps = { Minor: 1, Major: 1, Severe: 1 };

  it('is false unless the Strain track is entirely full', () => {
    expect(isSubdued(row(1, 2, 3, 4), [makeStatus('Minor'), makeStatus('Major', { Id: 'st-2' }), makeStatus('Severe', { Id: 'st-3' })], caps)).toBe(false);
  });

  it('is false when the Strain track is full but a Status slot is still open', () => {
    expect(isSubdued(row(1, 2, 3, 4, 5), [], caps)).toBe(false);
  });

  it('is true only when the Strain track and every severity slot are all full', () => {
    const statuses = [makeStatus('Minor', { Id: 'st-1' }), makeStatus('Major', { Id: 'st-2' }), makeStatus('Severe', { Id: 'st-3' })];
    expect(isSubdued(row(1, 2, 3, 4, 5), statuses, caps)).toBe(true);
  });
});

describe('advanceHealingTrack', () => {
  it('adds segments, clamped at the track length', () => {
    expect(advanceHealingTrack(0, 3, 5)).toBe(3);
    expect(advanceHealingTrack(3, 3, 5)).toBe(5);
  });
});
