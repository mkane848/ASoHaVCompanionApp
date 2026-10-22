import { describe, expect, it } from 'vitest';
import { canAddStatusPick, newStatusPick, statusPicksReady, type StatusPick } from './StatusPicks.js';
import { cleanStrainTag } from './StrainTagFields.js';

// The web workspace has no DOM test renderer, so the multi-Status picker's rules live in these pure
// helpers and are tested here; the markup itself is covered by CI's interaction smoke test.

const free = { Minor: 2, Major: 1, Severe: 0 };
const pick = (Severity: StatusPick['Severity'], Name = 'Hurt'): StatusPick => ({ Key: `k-${Severity}-${Name}`, Severity, Name });

describe('StatusPicks helpers', () => {
  it('a new pick lands in the first severity with room', () => {
    expect(newStatusPick(free, []).Severity).toBe('Minor');
    expect(newStatusPick(free, [pick('Minor', 'a'), pick('Minor', 'b')]).Severity).toBe('Major');
    expect(newStatusPick({ Minor: 0, Major: 0, Severe: 1 }, []).Severity).toBe('Severe');
  });

  it('gives each new pick its own key', () => {
    expect(newStatusPick(free, []).Key).not.toBe(newStatusPick(free, []).Key);
  });

  it('can add another only while some severity still has room', () => {
    expect(canAddStatusPick(free, [])).toBe(true);
    expect(canAddStatusPick(free, [pick('Minor', 'a'), pick('Minor', 'b')])).toBe(true); // Major is open
    expect(canAddStatusPick(free, [pick('Minor', 'a'), pick('Minor', 'b'), pick('Major')])).toBe(false);
  });

  it('is ready only when there is at least one pick, all are named, and the set fits', () => {
    expect(statusPicksReady(free, [])).toBe(false);
    expect(statusPicksReady(free, [pick('Minor'), pick('Major', 'Broken arm')])).toBe(true);
    expect(statusPicksReady(free, [pick('Minor', '  ')])).toBe(false);
    expect(statusPicksReady(free, [pick('Severe')])).toBe(false);
    expect(statusPicksReady(free, [pick('Minor', 'a'), pick('Minor', 'b'), pick('Minor', 'c')])).toBe(false);
  });
});

describe('cleanStrainTag', () => {
  it('leaves an untagged hit untagged and trims the effect', () => {
    expect(cleanStrainTag(undefined)).toBeUndefined();
    expect(cleanStrainTag({ OnBody: false, Effect: '  fire ' })).toEqual({ OnBody: false, Effect: 'fire' });
  });
});
