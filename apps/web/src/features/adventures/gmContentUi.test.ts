import { describe, expect, it } from 'vitest';
import type { GmContentMeta, NPC, Villain } from '@asohav/shared';
import { seedLibrary } from '@asohav/shared';
import {
  SCOPE_OPTIONS,
  blankDraft,
  changedData,
  createData,
  draftFromEntry,
  gmContentLabel,
  isFormDirty,
  kindNoun,
  missingRequired,
  readOnlyExplanation,
  unresolvedIds,
} from './gmContentUi.js';

const lib = seedLibrary();
const baseVillain = lib.villains[0]!;
const baseNpc = lib.npcs.find((n) => n.Stats)!;

const meta = (over: Partial<GmContentMeta> = {}): GmContentMeta => ({ OwnerUserId: 'u-me', OwnerName: 'Mike', Scope: 'Mine', ...over });
const villain = (over: Partial<Villain> = {}): Villain => ({ ...structuredClone(baseVillain), Id: 'gvil-1', Name: 'Ashmark', ...over });
const npc = (over: Partial<NPC> = {}): NPC => ({ ...structuredClone(baseNpc), Id: 'gnpc-1', Name: 'Skreel', ...over });

describe('gmContentLabel', () => {
  it('leaves a shared-library entry as its bare name', () => {
    expect(gmContentLabel(baseVillain, 'u-me')).toBe(baseVillain.Name);
  });

  it('marks the viewer\'s own private entry', () => {
    expect(gmContentLabel(villain({ Custom: meta() }), 'u-me')).toBe('Ashmark (yours)');
  });

  it('marks the viewer\'s own site-wide entry as both yours and published', () => {
    expect(gmContentLabel(villain({ Custom: meta({ Scope: 'SiteWide' }) }), 'u-me')).toBe('Ashmark (yours, site-wide)');
  });

  it('names the author of someone else\'s site-wide entry', () => {
    expect(gmContentLabel(npc({ Custom: meta({ OwnerUserId: 'u-sam', OwnerName: 'Sam', Scope: 'SiteWide' }) }), 'u-me')).toBe('Skreel — site-wide, by Sam');
  });

  it('falls back to a neutral author when the stored OwnerName is blank', () => {
    expect(gmContentLabel(npc({ Custom: meta({ OwnerUserId: 'u-sam', OwnerName: '', Scope: 'SiteWide' }) }), 'u-me')).toBe('Skreel — site-wide, by another GM');
  });

  it('with no known viewer (Combat), still calls a private entry yours but credits a site-wide one to its author', () => {
    expect(gmContentLabel(villain({ Custom: meta() }), null)).toBe('Ashmark (yours)');
    expect(gmContentLabel(villain({ Custom: meta({ Scope: 'SiteWide' }) }), null)).toBe('Ashmark — site-wide, by Mike');
  });

  it('does not render an empty name as an empty option', () => {
    expect(gmContentLabel(villain({ Name: '', Custom: meta() }), 'u-me')).toBe('(unnamed) (yours)');
  });
});

describe('readOnlyExplanation', () => {
  it('is null for a library entry and for anything the viewer can edit', () => {
    expect(readOnlyExplanation(baseVillain, false)).toBeNull();
    expect(readOnlyExplanation(villain({ Custom: meta() }), true)).toBeNull();
  });

  it('says what the GM can still do and who can change it', () => {
    const text = readOnlyExplanation(villain({ Custom: meta({ OwnerUserId: 'u-sam', OwnerName: 'Sam', Scope: 'SiteWide' }) }), false);
    expect(text).toContain('use it in your Adventures and Combats');
    expect(text).toContain('only Sam can change it');
  });
});

describe('unresolvedIds', () => {
  const entries = [{ Id: 'a' }, { Id: 'b' }];

  it('returns the ids that no longer resolve, in order', () => {
    expect(unresolvedIds(['b', 'gone-1', 'a', 'gone-2'], entries)).toEqual(['gone-1', 'gone-2']);
  });

  it('returns nothing when every reference resolves, or there are none', () => {
    expect(unresolvedIds(['a', 'b'], entries)).toEqual([]);
    expect(unresolvedIds([], entries)).toEqual([]);
  });

  it('treats every id as unresolved against an empty list (the author took the only copy)', () => {
    expect(unresolvedIds(['a'], [])).toEqual(['a']);
  });
});

describe('scope copy', () => {
  it('offers exactly the two scopes, private first and the default', () => {
    expect(SCOPE_OPTIONS.map((o) => o.value)).toEqual(['Mine', 'SiteWide']);
  });

  it('tells the author a site-wide entry is visible to every GM and only they can change it', () => {
    const siteWide = SCOPE_OPTIONS.find((o) => o.value === 'SiteWide')!;
    expect(siteWide.description).toMatch(/Every GM can see it/);
    expect(siteWide.description).toMatch(/only you can change it/);
  });
});

describe('kindNoun', () => {
  it('names each kind the way the buttons do', () => {
    expect(kindNoun('villain')).toBe('Villain');
    expect(kindNoun('npc')).toBe('NPC');
  });
});

describe('the form draft', () => {
  it('starts blank with every list, text and bool at its empty value', () => {
    const v = blankDraft('villain');
    expect(v.Name).toBe('');
    expect(v.Aspects).toEqual([]);
    expect(v.Goal).toBe('');
    const n = blankDraft('npc');
    expect(n.IsCombatant).toBe(false);
    expect(n.SkillTags).toEqual([]);
  });

  it('reports a missing Name until it is non-blank — the only required field on either kind', () => {
    expect(missingRequired('villain', blankDraft('villain'))).toEqual(['Name']);
    expect(missingRequired('npc', { ...blankDraft('npc'), Name: '   ' })).toEqual(['Name']);
    expect(missingRequired('npc', { ...blankDraft('npc'), Name: 'Skreel' })).toEqual([]);
  });

  it('turns an existing entry into a draft without the server-owned Id and Custom', () => {
    const d = draftFromEntry('villain', villain({ Custom: meta() }));
    expect(d).not.toHaveProperty('Id');
    expect(d).not.toHaveProperty('Custom');
    expect(d.Name).toBe('Ashmark');
  });

  it('backfills a field a stored row predates, rather than handing the form undefined', () => {
    const stale = { ...villain({ Custom: meta() }), SkillTags: undefined } as unknown as Villain;
    expect(draftFromEntry('villain', stale).SkillTags).toEqual([]);
  });
});

describe('createData', () => {
  it('sends schema fields only — no Id, no Custom, nothing null — with the Name trimmed', () => {
    const data = createData('npc', { ...blankDraft('npc'), Name: '  Skreel  ', Type: null, Stats: null, Id: 'x', Custom: meta() });
    expect(data.Name).toBe('Skreel');
    expect(data).not.toHaveProperty('Type');
    expect(data).not.toHaveProperty('Stats');
    expect(data).not.toHaveProperty('Id');
    expect(data).not.toHaveProperty('Custom');
    expect(data.IsCombatant).toBe(false);
  });
});

describe('changedData', () => {
  const original = draftFromEntry('villain', villain({ Custom: meta() }));

  it('is empty when nothing changed', () => {
    expect(changedData('villain', original, { ...original })).toEqual({});
  });

  it('carries only the fields that differ', () => {
    expect(changedData('villain', original, { ...original, Goal: 'A new goal', Aspects: ['One'] })).toEqual({ Goal: 'A new goal', Aspects: ['One'] });
  });

  it('sends a cleared optional field as null so the server\'s merge actually clears it', () => {
    expect(changedData('villain', original, { ...original, Stats: null })).toEqual({ Stats: null });
  });

  it('trims a changed Name', () => {
    expect(changedData('villain', original, { ...original, Name: '  Brother Ashmark ' })).toEqual({ Name: 'Brother Ashmark' });
  });
});

describe('isFormDirty', () => {
  const original = blankDraft('villain');

  it('is clean for an untouched form, and for a field typed and then cleared back to null/undefined', () => {
    expect(isFormDirty({ original, draft: { ...original }, originalScope: 'Mine', scope: 'Mine' })).toBe(false);
    expect(isFormDirty({ original, draft: { ...original, Type: null }, originalScope: 'Mine', scope: 'Mine' })).toBe(false);
  });

  it('is dirty once a field or the scope moves', () => {
    expect(isFormDirty({ original, draft: { ...original, Name: 'A' }, originalScope: 'Mine', scope: 'Mine' })).toBe(true);
    expect(isFormDirty({ original, draft: { ...original }, originalScope: 'Mine', scope: 'SiteWide' })).toBe(true);
  });
});
