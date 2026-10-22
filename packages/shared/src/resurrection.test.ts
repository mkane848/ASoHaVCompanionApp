import { describe, expect, it } from 'vitest';
import { emptyMarks } from './engine.js';
import { applyResurrection, DeathRuleError, isResurrectionClockComplete, linkResurrectionClock } from './death.js';
import { newClock } from './clocks.js';
import { normalizeSheet } from './logic.js';
import type { CharacterSheet, Clock } from './types.js';

/** V0.7 slice 8c — Resurrection (Ruleset-V0.7.md L650-652; owner rulings of 2026-10-22). */

function dead(over: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    Strain: [true, true, false, false, true], StrainSecond: [false, true, false, false, false], TempStrain: 1,
    Statuses: [{ Id: 's1', Severity: 'Major', Name: 'Broken leg' }], Scars: [{ Id: 'sc1', Text: 'A scar', At: 'a' }],
    Dying: true, DyingChoice: 'Scar', LifeState: 'Dead',
    Ending: { Kind: 'BlazeOfGlory', Text: 'Held the bridge', At: 't' }, ResurrectionClockId: 'clk-1',
    ...over,
  } as unknown as CharacterSheet;
}

function clock(over: Partial<Clock> = {}): Clock {
  return { ...newClock({ CampaignId: 'cm-1', Title: 'The Rite', Kind: 'Project', Segments: 4 }), Id: 'clk-1', ...over };
}

describe('isResurrectionClockComplete', () => {
  it('is complete when the track is full, not before', () => {
    expect(isResurrectionClockComplete(clock({ SuccessMarks: 3 }))).toBe(false);
    expect(isResurrectionClockComplete(clock({ SuccessMarks: 4 }))).toBe(true);
  });
  it('honours a GM Resolve: Success counts at any fill, Failure never does', () => {
    expect(isResurrectionClockComplete(clock({ SuccessMarks: 1, Status: 'Resolved', ResolvedAs: 'Success' }))).toBe(true);
    expect(isResurrectionClockComplete(clock({ SuccessMarks: 4, Status: 'Resolved', ResolvedAs: 'Failure' }))).toBe(false);
  });
  it('does not guess when an Opposition Clock filled both tracks', () => {
    expect(isResurrectionClockComplete(clock({ Kind: 'Opposition', SuccessMarks: 4, FailureMarks: 4 }))).toBe(false);
  });
});

describe('linkResurrectionClock', () => {
  it('links and unlinks a Dead Hero', () => {
    const s = dead({ ResurrectionClockId: null });
    linkResurrectionClock(s, 'clk-9');
    expect(s.ResurrectionClockId).toBe('clk-9');
    linkResurrectionClock(s, null);
    expect(s.ResurrectionClockId).toBeNull();
  });
  it('refuses a Retired or living Hero', () => {
    expect(() => linkResurrectionClock(dead({ LifeState: 'Retired' }), 'c')).toThrow(DeathRuleError);
    expect(() => linkResurrectionClock(dead({ LifeState: 'Alive' }), 'c')).toThrow(DeathRuleError);
  });
});

describe('applyResurrection', () => {
  it('Return changes LifeState and Ending (and drops the link) and nothing else', () => {
    const s = dead();
    const before = structuredClone(s);
    applyResurrection(s, clock({ SuccessMarks: 4 }), 'Return');
    expect(s.LifeState).toBe('Alive');
    expect(s.Ending).toBeNull();
    expect(s.ResurrectionClockId).toBeNull();
    expect({ ...s, LifeState: before.LifeState, Ending: before.Ending, ResurrectionClockId: before.ResurrectionClockId }).toEqual(before);
    // Strain, Statuses, Scars and Dying are exactly as they were.
    expect(s.Dying).toBe(true);
    expect(s.StrainSecond).toEqual([false, true, false, false, false]);
  });

  it('Stay dead leaves the Hero Dead and only drops the link', () => {
    const s = dead();
    applyResurrection(s, clock({ SuccessMarks: 4 }), 'StayDead');
    expect(s.LifeState).toBe('Dead');
    expect(s.Ending).not.toBeNull();
    expect(s.ResurrectionClockId).toBeNull();
  });

  it('is refused for a Retired or living Hero, no link, a dangling link, an unfinished clock or a bad choice', () => {
    const done = clock({ SuccessMarks: 4 });
    expect(() => applyResurrection(dead({ LifeState: 'Retired' }), done, 'Return')).toThrow(DeathRuleError);
    expect(() => applyResurrection(dead({ LifeState: 'Alive' }), done, 'Return')).toThrow(DeathRuleError);
    expect(() => applyResurrection(dead({ ResurrectionClockId: null }), done, 'Return')).toThrow(DeathRuleError);
    expect(() => applyResurrection(dead(), null, 'Return')).toThrow(DeathRuleError);
    expect(() => applyResurrection(dead(), clock({ Id: 'other', SuccessMarks: 4 }), 'Return')).toThrow(DeathRuleError);
    expect(() => applyResurrection(dead(), clock({ SuccessMarks: 2 }), 'Return')).toThrow(DeathRuleError);
    expect(() => applyResurrection(dead(), done, 'Maybe' as never)).toThrow(DeathRuleError);
  });
});

describe('normalizeSheet and ResurrectionClockId', () => {
  const legacy = { Strain: emptyMarks(5), Statuses: [], Scars: [], Motifs: [], Virtues: [] } as unknown as CharacterSheet;
  it('reads a legacy row as unlinked', () => {
    expect(normalizeSheet(legacy).ResurrectionClockId).toBeNull();
    expect(normalizeSheet({ ...legacy, ResurrectionClockId: 5 } as unknown as CharacterSheet).ResurrectionClockId).toBeNull();
  });
  it('keeps a real link', () => {
    expect(normalizeSheet({ ...legacy, ResurrectionClockId: 'clk-1' } as unknown as CharacterSheet).ResurrectionClockId).toBe('clk-1');
  });
});
