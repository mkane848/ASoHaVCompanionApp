import type { GmContentKind, GmContentScope, NPC, Villain } from '@asohav/shared';
import { getCollection, gmContentCollectionKey, normalizeGmContentData } from '@asohav/shared';

/** Pure helpers behind Adventure Prep's "New Villain" / "New NPC" authoring — kept out of the
 *  components so the label wording, dangling-reference handling and the create/update payload
 *  shapes are unit-testable without rendering anything. */

export type GmEntry = Villain | NPC;
export type Draft = Record<string, unknown>;

export function kindNoun(kind: GmContentKind): 'Villain' | 'NPC' {
  return kind === 'villain' ? 'Villain' : 'NPC';
}

/** How an option is worded in a picker so a GM can tell their own entry, someone else's site-wide
 *  entry and a shared-library one apart. A library entry (no `Custom`) keeps its bare name.
 *
 *  `userId` is `null` where the caller does not know who is looking (Combat's Add participant
 *  modal). The server only ever sends a `Mine` entry to its author, so there a `Mine` entry is
 *  still "yours"; a site-wide one reads "site-wide, by <author>" even when it is the viewer's own. */
export function gmContentLabel(entry: GmEntry, userId: string | null): string {
  const custom = entry.Custom;
  if (!custom) return entry.Name;
  const name = entry.Name || '(unnamed)';
  const isMine = userId === null ? custom.Scope === 'Mine' : custom.OwnerUserId === userId;
  if (isMine) return custom.Scope === 'SiteWide' ? `${name} (yours, site-wide)` : `${name} (yours)`;
  const owner = custom.OwnerName || 'another GM';
  return custom.Scope === 'SiteWide' ? `${name} — site-wide, by ${owner}` : `${name} — by ${owner}`;
}

/** The sentence under a picker when the selected entry is somebody else's: what the GM can still
 *  do with it, and who can change it. `null` for anything the viewer can edit or a library entry. */
export function readOnlyExplanation(entry: GmEntry, canEdit: boolean): string | null {
  if (!entry.Custom || canEdit) return null;
  const owner = entry.Custom.OwnerName || 'its author';
  return `Site-wide, by ${owner} — you can use it in your Adventures and Combats, but only ${owner} can change it.`;
}

/** Ids that no longer resolve to an entry: the author deleted a site-wide entry, or switched it
 *  back to "just my campaigns". Order and duplicates follow `ids`. */
export function unresolvedIds(ids: readonly string[], entries: readonly { Id: string }[]): string[] {
  const known = new Set(entries.map((e) => e.Id));
  return ids.filter((id) => !known.has(id));
}

export interface ScopeOption {
  value: GmContentScope;
  title: string;
  description: string;
}

/** The two scopes in plain language. The site-wide copy says outright that every GM can read the
 *  entry — an author deciding whether to publish should not have to infer that. */
export const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: 'Mine',
    title: 'Just my campaigns',
    description: 'Only you can see and use it.',
  },
  {
    value: 'SiteWide',
    title: 'Site-wide',
    description: 'Every GM can see it and add it to their own campaigns, but only you can change it. Keep your private Secrets out of it.',
  },
];

/** Extra warning when a site-wide entry is being pulled back to private: GMs who already put it
 *  in an Adventure will see it as unavailable from then on. */
export const UNPUBLISH_WARNING =
  'Other GMs who already added this to an Adventure will see it as unavailable once you save.';

// ---------- the form's draft ----------

function fieldsFor(kind: GmContentKind) {
  return getCollection(gmContentCollectionKey(kind))?.fields ?? [];
}

/** Which `required` fields are still empty — the same test `AdminDetailForm` and the server's
 *  `validateCollectionBody` apply (null/undefined, or a blank string), read off the same schema flag. */
export function missingRequired(kind: GmContentKind, draft: Draft): string[] {
  return fieldsFor(kind)
    .filter((f) => f.required)
    .filter((f) => {
      const v = draft[f.name];
      return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    })
    .map((f) => f.name);
}

/** An empty Villain/NPC with every list, text and bool field at its empty value. */
export function blankDraft(kind: GmContentKind): Draft {
  return normalizeGmContentData(kind, {} as Villain) as unknown as Draft;
}

/** An existing entry as an editable draft: no `Id`/`Custom` (the server owns both). */
export function draftFromEntry(kind: GmContentKind, entry: GmEntry): Draft {
  const rest: Record<string, unknown> = { ...entry };
  delete rest.Id;
  delete rest.Custom;
  return normalizeGmContentData(kind, rest as unknown as Villain) as unknown as Draft;
}

/** The `data` of a create request: schema fields only, nothing null or undefined (a field the
 *  author left alone is simply absent), `Name` trimmed. */
export function createData(kind: GmContentKind, draft: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fieldsFor(kind)) {
    const v = draft[f.name];
    if (v === null || v === undefined) continue;
    out[f.name] = f.name === 'Name' && typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

/** The `data` of an update request: only fields that differ from what was loaded. The server
 *  merges, so an untouched field is never re-sent (and never overwrites an edit made elsewhere); a
 *  field the author cleared goes as `null`, which the server's validator accepts for any
 *  non-required field. */
export function changedData(kind: GmContentKind, original: Draft, draft: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fieldsFor(kind)) {
    const before = original[f.name] ?? null;
    const after = draft[f.name] ?? null;
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    out[f.name] = f.name === 'Name' && typeof after === 'string' ? after.trim() : after;
  }
  return out;
}

/** Whether leaving the form would discard something: any field differs from its starting value, or
 *  (for a new entry) the scope moved off the default. Compared by serialisation, not reference,
 *  because every keystroke rebuilds the draft object — the same reasoning as `isDraftDirty`. */
export function isFormDirty(opts: { original: Draft; draft: Draft; originalScope: GmContentScope; scope: GmContentScope }): boolean {
  const present = (d: Draft) => Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null && v !== undefined));
  return JSON.stringify(present(opts.original)) !== JSON.stringify(present(opts.draft)) || opts.originalScope !== opts.scope;
}
