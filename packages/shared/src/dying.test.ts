import { describe, expect, it } from 'vitest';
import {
  applyRecuperateEffect,
  canRecoverStatuses,
  emptyMarks,
  heroSpeed,
  HERO_BASE_SPEED,
  isDying,
  markRank,
  takeStrainHit,
} from './engine.js';
import { normalizeSheet } from './logic.js';
import type { CharacterSheet, CharacterStatus, StatusSeverity } from './types.js';

/** V0.7 slice 8a — Dying (Ruleset-V0.7.md L609-613): detection, Speed 0, no Recuperate / Status
 *  recovery. Risk Death, Scars, Blaze of Glory, the second Strain mark, Surrender and Resurrection
 *  are slices 8b/8c and are not covered here. */

const CAPS: Record<StatusSeverity, number> = { Minor: 2, Major: 1, Severe: 1 };
const status: CharacterStatus = { Id: 'st-1', Severity: 'Minor', Name: 'Twisted Ankle', Description: '' };
const full = () => [1, 2, 3, 4, 5].reduce((m, b) => markRank(m, b), emptyMarks());
const settings = { StrainTrackLength: 5, HealingTrackLength: 5 };

describe('Dying detection (a Strain hit that cannot be absorbed)', () => {
  it('a hit with no higher open box is Exhausted, so the Hero becomes Dying', () => {
    expect(takeStrainHit(full(), 0, 2).Exhausted).toBe(true);
  });

  it('a hit with a higher open box is not', () => {
    expect(takeStrainHit(markRank(emptyMarks(), 2), 0, 2).Exhausted).toBe(false);
  });

  it('a hit mitigated to 0 by a Status or Armor does not make a Hero Dying', () => {
    expect(takeStrainHit(full(), 0, 0).Exhausted).toBe(false);
  });

  it('an open Temporary Strain box absorbs the hit instead', () => {
    expect(takeStrainHit(full(), 1, 4).Exhausted).toBe(false);
  });
});

describe('Dying effects', () => {
  it('Speed is 6 normally and 0 while Dying or Immobilized', () => {
    expect(heroSpeed({})).toBe(HERO_BASE_SPEED);
    expect(heroSpeed({ Dying: true })).toBe(0);
    expect(heroSpeed({ Immobilized: true })).toBe(0);
  });

  it('isDying reads only a true flag', () => {
    expect(isDying({ Dying: true })).toBe(true);
    expect(isDying({ Dying: false })).toBe(false);
    expect(isDying({})).toBe(false);
  });

  it('a Dying Hero cannot recover Statuses', () => {
    expect(canRecoverStatuses({ Dying: true })).toBe(false);
    expect(canRecoverStatuses({})).toBe(true);
  });

  it('Recuperate does nothing for a Dying Hero: no Strain, no Status removed, no Healing Track', () => {
    const sheet = { Strain: emptyMarks(), Statuses: [status], HealingTrack: 1, Dying: true };
    const r = applyRecuperateEffect(sheet, 'st-1', 'Tier3', CAPS, settings);
    expect(r).toEqual({ Strain: sheet.Strain, Statuses: [status], HealingTrack: 1 });
  });

  it('Recuperate still works for a Hero who is not Dying', () => {
    const sheet = { Strain: emptyMarks(), Statuses: [status], HealingTrack: 1, Dying: false };
    const r = applyRecuperateEffect(sheet, 'st-1', 'Tier2', CAPS, settings);
    expect(r.Statuses).toEqual([]);
    expect(r.HealingTrack).toBe(3);
    expect(r.Strain.filter(Boolean).length).toBe(1);
  });
});

describe('normalizeSheet — Dying default', () => {
  const base = { Armor: [] } as unknown as CharacterSheet;

  it('defaults Dying to false on a sheet saved without it', () => {
    expect(normalizeSheet(base).Dying).toBe(false);
  });

  it('keeps a stored true, and reads junk as false', () => {
    expect(normalizeSheet({ ...base, Dying: true }).Dying).toBe(true);
    expect(normalizeSheet({ ...base, Dying: 'yes' as unknown as boolean }).Dying).toBe(false);
  });
});
