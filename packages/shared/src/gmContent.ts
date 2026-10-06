import type { GmContentMeta, Library, NPC, Villain } from './types.js';
import { getCollection } from './schema.js';

/** GM-authored Villains and NPCs (`0.67.0`) — content a GM writes from Adventure Prep rather than a
 *  Content Admin writing it into the shared library. Stored in `gm_content`, one row each, and
 *  merged into `library.villains`/`npcs` on the client so Adventure Prep and Combat read one list. */
export type GmContentKind = 'villain' | 'npc';

export const GM_CONTENT_KINDS: GmContentKind[] = ['villain', 'npc'];

/** A GM may keep this many entries of their own. Not a rules number — a ceiling so one account
 *  cannot grow a table every GM's list request reads. */
export const GM_CONTENT_OWNER_LIMIT = 200;

/** The `schema.ts` collection whose field list defines each kind — the same declaration Content
 *  Admin's form and the server's validator already read, so the two authoring surfaces cannot
 *  disagree about what a Villain is. */
export function gmContentCollectionKey(kind: GmContentKind): 'villains' | 'npcs' {
  return kind === 'villain' ? 'villains' : 'npcs';
}

export function gmContentIdPrefix(kind: GmContentKind): string {
  return kind === 'villain' ? 'gvil' : 'gnpc';
}

/** Read-time defaults for a stored entry, per CLAUDE.md's "adding a required field to a JSONB
 *  aggregate" rule: every list/text/bool field the schema declares gets its empty value, so a row
 *  written before a field existed still deserializes into something the form and cards can map
 *  over. `Stats` is left alone — it is optional on both shapes. */
export function normalizeGmContentData<T extends Villain | NPC>(kind: GmContentKind, data: T): T {
  const col = getCollection(gmContentCollectionKey(kind));
  const out: Record<string, unknown> = { ...data };
  for (const f of col?.fields ?? []) {
    if (out[f.name] !== undefined && out[f.name] !== null) continue;
    if (f.type === 'taglist' || f.type === 'multiref') out[f.name] = [];
    else if (f.type === 'text' || f.type === 'textarea') out[f.name] = '';
    else if (f.type === 'bool') out[f.name] = false;
  }
  return out as unknown as T;
}

/** Whether `userId` may edit or delete an entry: its author, or a Content Admin (who can already
 *  rewrite the whole library, so moderating a site-wide entry grants nothing new). Anyone else —
 *  including a GM who has the entry in their own Adventure — gets it read-only. */
export function canEditGmContent(entry: { Custom?: GmContentMeta }, userId: string, isAdmin: boolean): boolean {
  if (!entry.Custom) return false;
  return isAdmin || entry.Custom.OwnerUserId === userId;
}

/** The library with the caller's GM-authored entries appended after the shared ones. A new object,
 *  never a mutation of the cached `library` query result. */
export function withGmContent(library: Library, content: { villains: Villain[]; npcs: NPC[] } | undefined): Library {
  if (!content || (content.villains.length === 0 && content.npcs.length === 0)) return library;
  return {
    ...library,
    villains: [...library.villains, ...content.villains],
    npcs: [...library.npcs, ...content.npcs],
  };
}
