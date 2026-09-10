import { describe, expect, it } from 'vitest';
import { applyClockRoll, clockOutcome, isClockFull, newClock, tickClock } from './clocks.js';
import type { Clock } from './types.js';

describe('newClock', () => {
  it('defaults to 4 Segments and zeroed tracks', () => {
    const c = newClock({ CampaignId: 'cm-1', Title: 'Castle', Kind: 'Opposition' });
    expect(c.Segments).toBe(4);
    expect(c.SuccessMarks).toBe(0);
    expect(c.FailureMarks).toBe(0);
    expect(c.Status).toBe('Open');
  });

  it('accepts a custom Segments count', () => {
    const c = newClock({ CampaignId: 'cm-1', Title: 'Long War', Kind: 'Threat', Segments: 8 });
    expect(c.Segments).toBe(8);
  });

  it('leaves FailureMarks undefined for non-Opposition Kinds', () => {
    expect(newClock({ CampaignId: 'cm-1', Title: 'Revolution', Kind: 'TugOfWar' }).FailureMarks).toBeUndefined();
    expect(newClock({ CampaignId: 'cm-1', Title: 'Alert', Kind: 'Threat' }).FailureMarks).toBeUndefined();
    expect(newClock({ CampaignId: 'cm-1', Title: 'Forge the Blade', Kind: 'Project' }).FailureMarks).toBeUndefined();
  });

  it('defaults Goal/SkillTags/Developments/PromotedToBoard regardless of Kind', () => {
    const c = newClock({ CampaignId: 'cm-1', Title: 'Castle', Kind: 'Opposition' });
    expect(c.Goal).toBe('');
    expect(c.SkillTags).toEqual([]);
    expect(c.Developments).toEqual([]);
    expect(c.PromotedToBoard).toBe(false);
  });
});

describe('applyClockRoll', () => {
  const base = newClock({ CampaignId: 'cm-1', Title: 'Castle', Kind: 'Opposition', Segments: 6 });

  it('a 10+ (Tier3) only gains the Success track', () => {
    expect(applyClockRoll(base, 2, 'Tier3')).toEqual({ SuccessMarks: 2, FailureMarks: 0 });
  });

  it('a 7-9 (Tier2) gains both tracks', () => {
    expect(applyClockRoll(base, 3, 'Tier2')).toEqual({ SuccessMarks: 3, FailureMarks: 3 });
  });

  it('a 6- (Tier1) only gains the Failure track', () => {
    expect(applyClockRoll(base, 1, 'Tier1')).toEqual({ SuccessMarks: 0, FailureMarks: 1 });
  });

  it('clamps each track at Segments', () => {
    const nearlyFull: Clock = { ...base, SuccessMarks: 5, FailureMarks: 5 };
    expect(applyClockRoll(nearlyFull, 3, 'Tier2')).toEqual({ SuccessMarks: 6, FailureMarks: 6 });
  });
});

describe('tickClock', () => {
  const base = newClock({ CampaignId: 'cm-1', Title: 'Revolution', Kind: 'TugOfWar', Segments: 6 });

  it('ticks up', () => {
    expect(tickClock(base, 2)).toBe(2);
  });

  it('ticks down without going below 0', () => {
    expect(tickClock({ ...base, SuccessMarks: 1 }, -3)).toBe(0);
  });

  it('never exceeds Segments', () => {
    expect(tickClock({ ...base, SuccessMarks: 5 }, 3)).toBe(6);
  });
});

describe('clockOutcome', () => {
  const base = newClock({ CampaignId: 'cm-1', Title: 'Castle', Kind: 'Opposition', Segments: 4 });

  it('is null while both tracks are short of Segments', () => {
    expect(clockOutcome({ ...base, SuccessMarks: 2, FailureMarks: 1 })).toBeNull();
  });

  it('is Success once the Success track fills', () => {
    expect(clockOutcome({ ...base, SuccessMarks: 4, FailureMarks: 1 })).toBe('Success');
  });

  it('is Failure once the Failure track fills', () => {
    expect(clockOutcome({ ...base, SuccessMarks: 1, FailureMarks: 4 })).toBe('Failure');
  });

  it('is Both when a single roll fills both at once', () => {
    expect(clockOutcome({ ...base, SuccessMarks: 4, FailureMarks: 4 })).toBe('Both');
  });
});

describe('isClockFull', () => {
  it('reports the single/Success track reaching Segments', () => {
    const c = newClock({ CampaignId: 'cm-1', Title: 'Alert', Kind: 'Threat', Segments: 4 });
    expect(isClockFull(c)).toBe(false);
    expect(isClockFull({ ...c, SuccessMarks: 4 })).toBe(true);
  });
});
