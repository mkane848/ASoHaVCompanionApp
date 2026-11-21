import { describe, expect, it } from 'vitest';
import { applyStrainOfferToSheet, checkResolveStrainOfferRequest, OfferRuleError } from './offers.js';
import { seedLibrary } from './seedLibrary.js';
import type { CharacterSheet, PendingStrainOffer } from './types.js';

const offer: PendingStrainOffer = { Id: 'pso-1', TargetParticipantId: 'p-1', Amount: 3, Note: 'Cudgel', Resistable: true };
const ok = { Statuses: [], ArmorId: null, Amount: 1, Log: ['x'], DramaNote: null };
const sheet = (overrides: Partial<CharacterSheet> = {}) => ({
  Strain: [true, true, true, true, true], StrainSecond: [false, false, false, false, false], TempStrain: 0, Statuses: [], Armor: [],
  Virtues: [], Dying: false, DyingChoice: null, LifeState: 'Alive', StrainBoxBonus: 0, ...overrides,
}) as unknown as CharacterSheet;

describe('checkResolveStrainOfferRequest', () => {
  it('accepts a well-formed report and trims names', () => {
    const out = checkResolveStrainOfferRequest({ ...ok, Statuses: [{ Severity: 'Minor', Name: '  Bruised ' }] }, offer);
    expect(out.Statuses).toEqual([{ Severity: 'Minor', Name: 'Bruised' }]);
  });

  it.each([
    ['more Strain than the offer', { ...ok, Amount: 4 }],
    ['negative Strain', { ...ok, Amount: -1 }],
    ['a fraction', { ...ok, Amount: 1.5 }],
    ['a Status with no name', { ...ok, Statuses: [{ Severity: 'Minor', Name: ' ' }] }],
    ['an unknown severity', { ...ok, Statuses: [{ Severity: 'Huge', Name: 'x' }] }],
    ['too many log lines', { ...ok, Log: ['a', 'b', 'c', 'd'] }],
  ])('refuses %s with a 400', (_label, body) => {
    expect(() => checkResolveStrainOfferRequest(body, offer)).toThrow(OfferRuleError);
  });

  it('refuses a Status against Strain that cannot be Resisted', () => {
    expect(() => checkResolveStrainOfferRequest({ ...ok, Statuses: [{ Severity: 'Minor', Name: 'x' }] }, { ...offer, Resistable: false })).toThrow(/cannot be Resisted/);
  });
});

describe('applyStrainOfferToSheet', () => {
  const settings = seedLibrary().settings;

  it('makes a Hero Dying when no box can take the Strain', () => {
    const s = sheet();
    expect(applyStrainOfferToSheet(s, offer, { ...ok, Amount: 2 }, settings).Outcome).toBe('Dying');
    expect(s.Dying).toBe(true);
  });

  it('refuses Statuses that no longer fit the free slots (409)', () => {
    const full = Array.from({ length: settings.MinorStatusSlots }, (_, i) => ({ Id: `st-${i}`, Severity: 'Minor', Name: 'x', Description: '' }));
    const s = sheet({ Statuses: full as never });
    try {
      applyStrainOfferToSheet(s, offer, { ...ok, Statuses: [{ Severity: 'Minor', Name: 'one more' }] }, settings);
      expect.unreachable();
    } catch (err) {
      expect((err as OfferRuleError).status).toBe(409);
    }
  });
});
