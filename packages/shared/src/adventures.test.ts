import { describe, expect, it } from 'vitest';
import { ADVENTURE_TYPES, currentCountdownStep, newAdventure, tickAdventureCountdown } from './adventures.js';
import { ADVENTURE_COUNTDOWN_STEP_NAMES } from './types.js';

describe('newAdventure', () => {
  it('defaults to empty Concept/Hook, no Type, Active status', () => {
    const a = newAdventure({ CampaignId: 'cm-1' });
    expect(a.Concept).toBe('');
    expect(a.Hook).toBe('');
    expect(a.Type).toBeNull();
    expect(a.Status).toBe('Active');
    expect(a.VillainId).toBeNull();
    expect(a.NpcIds).toEqual([]);
    expect(a.LocationIds).toEqual([]);
    expect(a.Secrets).toEqual([]);
  });

  it('accepts an initial Concept/Type/Hook', () => {
    const a = newAdventure({ CampaignId: 'cm-1', Concept: 'Goblins in the woods', Type: 'Mystery', Hook: 'Rosa barges in.' });
    expect(a.Concept).toBe('Goblins in the woods');
    expect(a.Type).toBe('Mystery');
    expect(a.Hook).toBe('Rosa barges in.');
  });

  it('pre-seeds all five named Countdown steps with empty Text, in doc order', () => {
    const a = newAdventure({ CampaignId: 'cm-1' });
    expect(a.CountdownSteps.map((s) => s.Name)).toEqual([...ADVENTURE_COUNTDOWN_STEP_NAMES]);
    expect(a.CountdownSteps.every((s) => s.Text === '')).toBe(true);
  });

  it('starts CountdownMarks at 0', () => {
    expect(newAdventure({ CampaignId: 'cm-1' }).CountdownMarks).toBe(0);
  });
});

describe('ADVENTURE_TYPES', () => {
  it('lists exactly the six doc-named Types, each with a summary and elements hint', () => {
    expect(ADVENTURE_TYPES.map((t) => t.key)).toEqual(['Offensive', 'Stand', 'Race', 'Mission', 'Mystery', 'Journey']);
    for (const t of ADVENTURE_TYPES) {
      expect(t.summary.length).toBeGreaterThan(0);
      expect(t.elements.length).toBeGreaterThan(0);
    }
  });
});

describe('tickAdventureCountdown', () => {
  const base = newAdventure({ CampaignId: 'cm-1' });

  it('ticks up from 0', () => {
    expect(tickAdventureCountdown(base, 2)).toBe(2);
  });

  it('never exceeds the number of named steps (5)', () => {
    expect(tickAdventureCountdown({ ...base, CountdownMarks: 4 }, 3)).toBe(5);
  });

  it('ticks down without going below 0', () => {
    expect(tickAdventureCountdown({ ...base, CountdownMarks: 1 }, -3)).toBe(0);
  });
});

describe('currentCountdownStep', () => {
  const base = newAdventure({ CampaignId: 'cm-1' });

  it('is null before the Countdown has begun', () => {
    expect(currentCountdownStep(base)).toBeNull();
  });

  it('is the step at CountdownMarks - 1 once ticked', () => {
    expect(currentCountdownStep({ ...base, CountdownMarks: 1 })?.Name).toBe('Seed');
    expect(currentCountdownStep({ ...base, CountdownMarks: 3 })?.Name).toBe('Wilt');
    expect(currentCountdownStep({ ...base, CountdownMarks: 5 })?.Name).toBe('Rot');
  });
});
