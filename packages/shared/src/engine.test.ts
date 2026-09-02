import { describe, expect, it } from 'vitest';
import {
  applyOpposingStatus,
  computeRollBreakdown,
  giveStatus,
  healStatus,
  healingSurgeAmount,
  resistRollReduction,
  resolveRiskDeath,
  sortStatuses,
  statusRank,
  markRank,
  emptyMarks,
  reduceRank,
  isUnstable,
  negativeStatusRankTotal,
  UNSTABLE_AT_RANK,
} from './engine.js';
import { seedLibrary } from './seedLibrary.js';
import type { CharacterSheet, CharacterStatus, Library } from './types.js';

/** Builds a Status at a given Rank by marking that one box — the common case. Tests that care
 *  about a *sparse* row (which is what the box model exists for) build `Marks` literally. */
function makeStatus(rank: number, overrides: Partial<CharacterStatus> = {}): CharacterStatus {
  return {
    Id: 'st-1',
    Name: 'Rattled',
    Marks: markRank(emptyMarks(), rank),
    Polarity: 'Negative',
    LinkedToIds: [],
    AffectedByIds: [],
    ...overrides,
  };
}

/** `[_, X, _, X, _, _]` shorthand: `row(2, 4)` marks boxes 2 and 4. */
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
    Statuses: [],
    Armor: [],
    Motifs: [],
    Load: { Tier: 'Normal', LatchedUntilCamp: false },
    Items: [],
    Advancement: { History: [] },
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

  it('keeps the single highest helpful and hindering Status separate from Total', () => {
    const sheet = makeSheet({
      Statuses: [
        makeStatus(2, { Id: 'st-a', Name: 'Prepared', Polarity: 'Positive' }),
        makeStatus(1, { Id: 'st-b', Name: 'Sharp', Polarity: 'Positive' }),
        makeStatus(3, { Id: 'st-c', Name: 'Rattled', Polarity: 'Negative' }),
        makeStatus(1, { Id: 'st-d', Name: 'Exposed', Polarity: 'Negative' }),
      ],
    });
    const b = computeRollBreakdown(sheet, 'v-might', library);
    // Total is Might's own base score only (1) — Status no longer folds in, see StatusSources.
    expect(b.Total).toBe(1);
    expect(b.Sources.filter((s) => s.Kind === 'Status')).toHaveLength(0);
    expect(b.StatusSources).toEqual([
      { Label: 'Prepared (highest helpful Status)', Value: 2, Kind: 'Status' },
      { Label: 'Rattled (highest hindering Status)', Value: -3, Kind: 'Status' },
    ]);
  });

  it('never counts a Neutral Status as helpful or hindering', () => {
    const sheet = makeSheet({
      Statuses: [makeStatus(5, { Id: 'st-e', Name: 'Watched', Polarity: 'Neutral' })],
    });
    const b = computeRollBreakdown(sheet, 'v-might', library);
    expect(b.Total).toBe(1); // base Might only — the Rank-5 Neutral Status contributes nothing
    expect(b.StatusSources).toHaveLength(0);
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

describe('box-row primitives', () => {
  describe('statusRank', () => {
    it('is the highest marked box, not a count of marks', () => {
      // The whole reason a Status stopped being an integer: this row has two marks but is Rank 4.
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
      // V0.5: "Mark the box corresponding to the new Rank, or the next empty box to the right if
      // that Rank is already marked." Distracted 2 twice is Rank 3, not Rank 2 again.
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
      const saturated = row(4, 5, 6);
      expect(markRank(saturated, 4)).toEqual(saturated);
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

  describe('isUnstable', () => {
    it('is true at Rank 4 of any Status', () => {
      expect(isUnstable([makeStatus(UNSTABLE_AT_RANK)])).toBe(true);
    });

    it('is false below Rank 4', () => {
      expect(isUnstable([makeStatus(3)])).toBe(false);
    });

    it('counts a sparse row by its Rank, not its mark count', () => {
      // Two marks, but Rank 4 — Unstable.
      expect(isUnstable([makeStatus(1, { Marks: row(1, 4) })])).toBe(true);
    });
  });

  describe('negativeStatusRankTotal', () => {
    it('counts only Negative Statuses, not Neutral or Positive ones', () => {
      const sheet = makeSheet({
        Statuses: [
          makeStatus(3, { Id: 'st-1', Name: 'Bleeding', Polarity: 'Negative' }),
          makeStatus(5, { Id: 'st-2', Name: 'Watched', Polarity: 'Neutral' }),
          makeStatus(4, { Id: 'st-3', Name: 'Inspired', Polarity: 'Positive' }),
        ],
      });
      expect(negativeStatusRankTotal(sheet)).toBe(3);
    });
  });
});

describe('giveStatus', () => {
  it('creates a new Status when none exists', () => {
    const { Statuses, Subdued } = giveStatus([], { Name: 'Bleeding', Polarity: 'Negative', Rank: 3 });
    expect(Statuses).toHaveLength(1);
    expect(Statuses[0]).toMatchObject({ Name: 'Bleeding', Polarity: 'Negative' });
    expect(statusRank(Statuses[0])).toBe(3);
    expect(Subdued).toBe(false);
  });

  it('marks the next empty box right rather than summing — Rank 2 twice is Rank 3', () => {
    // Deliberately different from the pre-`0.28.0` additive behaviour, which made this Rank 4.
    const existing = [makeStatus(2, { Name: 'Bleeding', Polarity: 'Negative' })];
    const { Statuses } = giveStatus(existing, { Name: 'Bleeding', Polarity: 'Negative', Rank: 2 });
    expect(statusRank(Statuses[0])).toBe(3);
  });

  it('leaves the row sparse when a higher Rank lands over a lower mark', () => {
    const existing = [makeStatus(2, { Name: 'Distracted', Polarity: 'Negative' })];
    const { Statuses } = giveStatus(existing, { Name: 'Distracted', Polarity: 'Negative', Rank: 4 });
    expect(statusRank(Statuses[0])).toBe(4);
    expect(Statuses[0].Marks.slice(0, 4)).toEqual([false, true, false, true]);
  });

  it('flags Subdued for a Negative Status reaching the Subdued box', () => {
    const existing = [makeStatus(5, { Name: 'Bleeding', Polarity: 'Negative' })];
    const { Statuses, Subdued } = giveStatus(existing, { Name: 'Bleeding', Polarity: 'Negative', Rank: 5 });
    expect(statusRank(Statuses[0])).toBe(6);
    expect(Subdued).toBe(true);
  });

  it('does not flag Subdued for a Positive Status at the cap', () => {
    const existing = [makeStatus(5, { Name: 'Inspired', Polarity: 'Positive' })];
    const { Subdued } = giveStatus(existing, { Name: 'Inspired', Polarity: 'Positive', Rank: 5 });
    expect(Subdued).toBe(false);
  });

  it('does not flag Subdued for a Neutral Status at the cap either — only Negative triggers it', () => {
    const existing = [makeStatus(5, { Name: 'Watched', Polarity: 'Neutral' })];
    const { Statuses, Subdued } = giveStatus(existing, { Name: 'Watched', Polarity: 'Neutral', Rank: 5 });
    expect(statusRank(Statuses[0])).toBe(6);
    expect(Subdued).toBe(false);
  });

  it('is a no-op for a non-positive incoming Rank', () => {
    const existing = [makeStatus(2)];
    expect(giveStatus(existing, { Name: 'Rattled', Polarity: 'Negative', Rank: 0 }).Statuses).toBe(existing);
  });
});

describe('healStatus', () => {
  it('clears MARKS, not Ranks — a single mark at box 2 is cleared by a reduction of 1', () => {
    // Worth pinning explicitly, because it is where the box model most visibly parts company
    // with the old integer one. Rank 2 held as a lone mark on box 2 does not become Rank 1 when
    // reduced by 1; the only mark is gone, so the Status is gone. V0.5: "clear marks equal to
    // the reduction, starting from the highest box."
    const existing = [makeStatus(2, { Id: 'st-1' })];
    expect(healStatus(existing, 'st-1', 1)).toHaveLength(0);
  });

  it('steps down through a filled row one mark at a time', () => {
    const existing = [makeStatus(1, { Id: 'st-1', Marks: row(1, 2, 3) })];
    expect(statusRank(healStatus(existing, 'st-1', 1)[0])).toBe(2);
    expect(healStatus(existing, 'st-1', 5)).toHaveLength(0);
  });

  it('clears the highest marks of a sparse row first', () => {
    const existing = [makeStatus(1, { Id: 'st-1', Marks: row(1, 2, 5) })];
    expect(statusRank(healStatus(existing, 'st-1', 1)[0])).toBe(2);
  });
});

describe('applyOpposingStatus', () => {
  it('reduces the opposing Status rank-for-rank, leaving it in place if it survives', () => {
    const existing = [makeStatus(3, { Id: 'st-hostile', Name: 'Hostile', Polarity: 'Negative' })];
    const { Statuses } = applyOpposingStatus(existing, { Name: 'Friendly', Polarity: 'Positive', Rank: 2 }, 'st-hostile');
    expect(Statuses).toHaveLength(1);
    expect(Statuses[0]).toMatchObject({ Name: 'Hostile' });
    expect(statusRank(Statuses[0])).toBe(1);
  });

  it('flips to the incoming Status when it overcomes the opposing one', () => {
    const existing = [makeStatus(2, { Id: 'st-hostile', Name: 'Hostile', Polarity: 'Negative' })];
    const { Statuses } = applyOpposingStatus(existing, { Name: 'Friendly', Polarity: 'Positive', Rank: 3 }, 'st-hostile');
    expect(Statuses).toHaveLength(1);
    expect(Statuses[0]).toMatchObject({ Name: 'Friendly' });
    expect(statusRank(Statuses[0])).toBe(1);
  });

  it('clears both on an exact match', () => {
    const existing = [makeStatus(2, { Id: 'st-hostile', Name: 'Hostile', Polarity: 'Negative' })];
    const { Statuses } = applyOpposingStatus(existing, { Name: 'Friendly', Polarity: 'Positive', Rank: 2 }, 'st-hostile');
    expect(Statuses).toHaveLength(0);
  });

  it('reports Subdued when a Negative flip lands on the Subdued box', () => {
    // Regression: before `0.28.0` this path took no cap and returned a bare array, so a flip past
    // the cap never ran the Subdued flow.
    const existing = [makeStatus(1, { Id: 'st-calm', Name: 'Calm', Polarity: 'Positive' })];
    const { Statuses, Subdued } = applyOpposingStatus(existing, { Name: 'Panicked', Polarity: 'Negative', Rank: 7 }, 'st-calm');
    expect(statusRank(Statuses[0])).toBe(6);
    expect(Subdued).toBe(true);
  });

  it('falls back to a plain give when the opposing id does not resolve', () => {
    const { Statuses } = applyOpposingStatus([], { Name: 'Friendly', Polarity: 'Positive', Rank: 2 }, 'nope');
    expect(statusRank(Statuses[0])).toBe(2);
  });
});

describe('sortStatuses', () => {
  it('orders Positive before Neutral before Negative', () => {
    const statuses = [
      makeStatus(1, { Id: 'st-1', Name: 'Hurt', Polarity: 'Negative' }),
      makeStatus(1, { Id: 'st-2', Name: 'Curious', Polarity: 'Neutral' }),
      makeStatus(1, { Id: 'st-3', Name: 'Braced', Polarity: 'Positive' }),
    ];
    expect(sortStatuses(statuses).map((s) => s.Name)).toEqual(['Braced', 'Curious', 'Hurt']);
  });

  it('breaks a polarity tie by Rank descending', () => {
    const statuses = [
      makeStatus(2, { Id: 'st-1', Name: 'Rattled', Polarity: 'Negative' }),
      makeStatus(4, { Id: 'st-2', Name: 'Bleeding', Polarity: 'Negative' }),
      makeStatus(3, { Id: 'st-3', Name: 'Winded', Polarity: 'Negative' }),
    ];
    expect(sortStatuses(statuses).map((s) => s.Name)).toEqual(['Bleeding', 'Winded', 'Rattled']);
  });

  it('breaks a polarity+Rank tie by name A-Z, case-insensitively', () => {
    const statuses = [
      makeStatus(2, { Id: 'st-1', Name: 'winded', Polarity: 'Negative' }),
      makeStatus(2, { Id: 'st-2', Name: 'Bleeding', Polarity: 'Negative' }),
      makeStatus(2, { Id: 'st-3', Name: 'Afraid', Polarity: 'Negative' }),
    ];
    expect(sortStatuses(statuses).map((s) => s.Name)).toEqual(['Afraid', 'Bleeding', 'winded']);
  });

  it('does not mutate the input array', () => {
    const statuses = [
      makeStatus(1, { Id: 'st-1', Name: 'Hurt', Polarity: 'Negative' }),
      makeStatus(1, { Id: 'st-2', Name: 'Braced', Polarity: 'Positive' }),
    ];
    const original = [...statuses];
    sortStatuses(statuses);
    expect(statuses).toEqual(original);
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
