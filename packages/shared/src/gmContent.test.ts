import { describe, expect, it } from 'vitest';
import type { Library, NPC, Villain } from './types.js';
import { seedLibrary } from './seedLibrary.js';
import {
  GM_CONTENT_KINDS,
  GM_CONTENT_OWNER_LIMIT,
  canEditGmContent,
  gmContentCollectionKey,
  gmContentIdPrefix,
  normalizeGmContentData,
  withGmContent,
} from './gmContent.js';

/** A stored row as an older client wrote it: only the fields that existed then. */
function sparse<T>(fields: Record<string, unknown>): T {
  return fields as unknown as T;
}

function customVillain(id: string, owner = 'u-author'): Villain {
  return {
    Id: id,
    Name: `Villain ${id}`,
    Aspects: [],
    Goal: '',
    Scar: '',
    SkillTags: [],
    Resources: [],
    Powers: '',
    Attacks: '',
    Resistances: '',
    Vulnerabilities: '',
    Custom: { OwnerUserId: owner, OwnerName: 'Author', Scope: 'Mine' },
  };
}

function customNpc(id: string, owner = 'u-author'): NPC {
  return {
    Id: id,
    Name: `NPC ${id}`,
    Aspects: [],
    Type: 'Minion',
    Goal: '',
    HeroConnection: '',
    SkillTags: [],
    IsCombatant: true,
    Custom: { OwnerUserId: owner, OwnerName: 'Author', Scope: 'SiteWide' },
  };
}

describe('gmContentCollectionKey / gmContentIdPrefix', () => {
  it('maps each kind to the schema.ts collection Content Admin already uses', () => {
    expect(gmContentCollectionKey('villain')).toBe('villains');
    expect(gmContentCollectionKey('npc')).toBe('npcs');
  });

  it('gives each kind its own id prefix, distinct from the library ids', () => {
    expect(gmContentIdPrefix('villain')).toBe('gvil');
    expect(gmContentIdPrefix('npc')).toBe('gnpc');
    const lib = seedLibrary();
    for (const v of lib.villains) expect(v.Id.startsWith('gvil')).toBe(false);
    for (const n of lib.npcs) expect(n.Id.startsWith('gnpc')).toBe(false);
  });

  it('covers every kind it exports', () => {
    expect(new Set(GM_CONTENT_KINDS.map(gmContentIdPrefix)).size).toBe(GM_CONTENT_KINDS.length);
  });

  it('exposes the per-author ceiling as 200', () => {
    expect(GM_CONTENT_OWNER_LIMIT).toBe(200);
  });
});

describe('normalizeGmContentData', () => {
  it('fills list and text defaults on a Villain that has none of them', () => {
    const out = normalizeGmContentData('villain', sparse<Villain>({ Id: 'gvil-1', Name: 'Old Row' }));
    expect(out.Aspects).toEqual([]);
    expect(out.SkillTags).toEqual([]);
    expect(out.Resources).toEqual([]);
    for (const f of ['Goal', 'Scar', 'Powers', 'Attacks', 'Resistances', 'Vulnerabilities'] as const) {
      expect(out[f]).toBe('');
    }
    expect(out.Name).toBe('Old Row');
  });

  it('fills the NPC defaults, including the IsCombatant bool', () => {
    const out = normalizeGmContentData('npc', sparse<NPC>({ Id: 'gnpc-1', Name: 'Old Row' }));
    expect(out.IsCombatant).toBe(false);
    expect(out.Aspects).toEqual([]);
    expect(out.SkillTags).toEqual([]);
    expect(out.Goal).toBe('');
    expect(out.HeroConnection).toBe('');
    expect(out.Name).toBe('Old Row');
  });

  it('does not invent a value for an enum field', () => {
    const out = normalizeGmContentData('npc', sparse<NPC>({ Id: 'gnpc-1', Name: 'N' }));
    expect(out.Type).toBeUndefined();
  });

  it('treats null like a missing field', () => {
    const out = normalizeGmContentData('villain', sparse<Villain>({ Id: 'gvil-1', Name: 'N', Resources: null, Goal: null }));
    expect(out.Resources).toEqual([]);
    expect(out.Goal).toBe('');
  });

  it('leaves provided values alone, falsy ones included', () => {
    const out = normalizeGmContentData('npc', sparse<NPC>({ Id: 'gnpc-1', Name: 'Skreel', Type: 'Minion', IsCombatant: true }));
    expect(out.IsCombatant).toBe(true);
    expect(out.Type).toBe('Minion');
    const v = normalizeGmContentData('villain', sparse<Villain>({ Id: 'gvil-1', Name: 'N', Goal: '', Resources: ['a', 'b'] }));
    expect(v.Goal).toBe('');
    expect(v.Resources).toEqual(['a', 'b']);
  });

  it('leaves Stats alone — absent stays absent, present is kept by reference', () => {
    const none = normalizeGmContentData('villain', sparse<Villain>({ Id: 'gvil-1', Name: 'N' }));
    expect('Stats' in none).toBe(false);
    const stats = { Profile: 'Minion' } as unknown as NonNullable<Villain['Stats']>;
    const some = normalizeGmContentData('npc', sparse<NPC>({ Id: 'gnpc-1', Name: 'N', Stats: stats }));
    expect(some.Stats).toBe(stats);
  });

  it('does not mutate its input', () => {
    const input = sparse<Villain>({ Id: 'gvil-1', Name: 'N' });
    const snapshot = JSON.parse(JSON.stringify(input));
    const out = normalizeGmContentData('villain', input);
    expect(input).toEqual(snapshot);
    expect(out).not.toBe(input);
    expect('Resources' in input).toBe(false);
  });
});

describe('canEditGmContent', () => {
  const entry = customVillain('gvil-1', 'u-author');

  it('lets the author edit', () => {
    expect(canEditGmContent(entry, 'u-author', false)).toBe(true);
  });

  it('lets a Content Admin edit anyone\'s entry', () => {
    expect(canEditGmContent(entry, 'u-admin', true)).toBe(true);
  });

  it('gives any other GM the entry read-only', () => {
    expect(canEditGmContent(entry, 'u-other', false)).toBe(false);
  });

  it('is false for an entry with no Custom, even for an admin — a library entry is edited in Content Admin', () => {
    const libraryEntry = seedLibrary().villains[0]!;
    expect(libraryEntry.Custom).toBeUndefined();
    expect(canEditGmContent(libraryEntry, 'u-author', false)).toBe(false);
    expect(canEditGmContent(libraryEntry, 'u-admin', true)).toBe(false);
  });
});

describe('withGmContent', () => {
  const library = seedLibrary();

  it('returns the very same library object when there is no content', () => {
    expect(withGmContent(library, undefined)).toBe(library);
    expect(withGmContent(library, { villains: [], npcs: [] })).toBe(library);
  });

  it('appends the GM entries after the shared ones, in order', () => {
    const v1 = customVillain('gvil-1');
    const v2 = customVillain('gvil-2');
    const n1 = customNpc('gnpc-1');
    const merged = withGmContent(library, { villains: [v1, v2], npcs: [n1] });
    expect(merged.villains).toEqual([...library.villains, v1, v2]);
    expect(merged.npcs).toEqual([...library.npcs, n1]);
    expect(merged.villains.slice(0, library.villains.length)).toEqual(library.villains);
  });

  it('merges when only one kind has entries', () => {
    const n1 = customNpc('gnpc-1');
    const merged = withGmContent(library, { villains: [], npcs: [n1] });
    expect(merged.villains).toEqual(library.villains);
    expect(merged.npcs).toEqual([...library.npcs, n1]);
  });

  it('leaves every other collection of the library untouched', () => {
    const merged = withGmContent(library, { villains: [customVillain('gvil-1')], npcs: [] });
    expect(merged).not.toBe(library);
    expect(merged.locations).toBe(library.locations);
    expect(merged.moves).toBe(library.moves);
  });

  it('does not mutate the input library or its arrays', () => {
    const lib: Library = JSON.parse(JSON.stringify(library));
    const villainsBefore = lib.villains;
    const npcsBefore = lib.npcs;
    const villainCount = lib.villains.length;
    const npcCount = lib.npcs.length;
    withGmContent(lib, { villains: [customVillain('gvil-1')], npcs: [customNpc('gnpc-1')] });
    expect(lib.villains).toBe(villainsBefore);
    expect(lib.npcs).toBe(npcsBefore);
    expect(lib.villains).toHaveLength(villainCount);
    expect(lib.npcs).toHaveLength(npcCount);
    expect(lib).toEqual(library);
  });
});
