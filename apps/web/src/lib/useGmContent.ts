import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GmContentCreateRequest, GmContentList, GmContentUpdateRequest, Library, NPC, Villain } from '@asohav/shared';
import { normalizeGmContentData, withGmContent } from '@asohav/shared';
import { api } from './api.js';

const KEY = ['gmContent'] as const;

/** Read-time defaults, per CLAUDE.md's JSONB rule — the server normalizes too, but a row written
 *  before a schema field existed must never reach a form or card as `undefined`. Module-scope so
 *  `useQuery` sees one stable `select` and only re-runs it when the data changes. */
function normalizeList(list: GmContentList): GmContentList {
  return {
    villains: list.villains.map((v) => normalizeGmContentData('villain', v)),
    npcs: list.npcs.map((n) => normalizeGmContentData('npc', n)),
  };
}

/** The caller's own GM-authored Villains/NPCs plus every site-wide one (`0.67.0`). Server-side this
 *  is 403 for anyone who is neither a Content Admin nor a GM of some campaign, so a caller passes
 *  `enabled: false` for a Player rather than fetching and swallowing the error. */
export function useGmContent(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    queryFn: api.gmContent.list,
    enabled,
    select: normalizeList,
    // Site-wide entries change when *another* GM writes, and there is no Realtime channel for this
    // table — a minute keeps a GM's own Adventure Prep/Combat visits cheap while still picking up a
    // colleague's new entry on the next navigation. The author's own writes update the cache
    // directly (below), so they never wait on this.
    staleTime: 60_000,
  });
}

/** Writes the entry into the cached list right away. Without this a just-created Villain would not
 *  be an option in the picker until the invalidate-triggered refetch lands, so auto-selecting it on
 *  the Adventure would briefly point at a value the `<select>` has no option for. */
function upsertInCache(list: GmContentList | undefined, kind: 'villain' | 'npc', entry: Villain | NPC): GmContentList {
  const base: GmContentList = list ?? { villains: [], npcs: [] };
  const key = kind === 'villain' ? 'villains' : 'npcs';
  const rows = base[key] as (Villain | NPC)[];
  const next = rows.some((r) => r.Id === entry.Id) ? rows.map((r) => (r.Id === entry.Id ? entry : r)) : [...rows, entry];
  return { ...base, [key]: next } as GmContentList;
}

/** Create/update/remove, each resolving with what the server saved and **rejecting with its
 *  message** (`ApiError.message` is the server's `{error}` text, e.g. "Name is required." or the
 *  200-entry-cap 409) so the form can show it inline rather than toast it. */
export function useGmContentActions() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (body: GmContentCreateRequest) => api.gmContent.create(body),
    onSuccess: ({ entry }, body) => {
      qc.setQueryData<GmContentList>(KEY, (old) => upsertInCache(old, body.kind, entry));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: GmContentUpdateRequest; kind: 'villain' | 'npc' }) => api.gmContent.update(id, body),
    onSuccess: ({ entry }, vars) => {
      qc.setQueryData<GmContentList>(KEY, (old) => upsertInCache(old, vars.kind, entry));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string; kind: 'villain' | 'npc' }) => api.gmContent.remove(id),
    onSuccess: (_void, vars) => {
      qc.setQueryData<GmContentList>(KEY, (old) => {
        if (!old) return old;
        return vars.kind === 'villain'
          ? { ...old, villains: old.villains.filter((v) => v.Id !== vars.id) }
          : { ...old, npcs: old.npcs.filter((n) => n.Id !== vars.id) };
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return {
    create: (body: GmContentCreateRequest) => create.mutateAsync(body).then((r) => r.entry),
    update: (kind: 'villain' | 'npc', id: string, body: GmContentUpdateRequest) => update.mutateAsync({ id, body, kind }).then((r) => r.entry),
    remove: (kind: 'villain' | 'npc', id: string) => remove.mutateAsync({ id, kind }),
    pending: create.isPending || update.isPending || remove.isPending,
  };
}

/** `library` with the viewer's GM-authored entries appended to `villains`/`npcs`, so Adventure Prep
 *  and the Combat "Add participant" tabs read one list. Memoized on the two inputs: `withGmContent`
 *  returns the same `library` object when there is nothing to add, and a new one only when the
 *  library or the fetched list actually changed — so a consumer's effects/memos don't re-run on
 *  every render. `enabled` is false for a Player, who neither fetches nor sees any of it. */
export function useLibraryWithGmContent(library: Library, enabled: boolean): Library {
  const { data } = useGmContent(enabled);
  return useMemo(() => withGmContent(library, enabled ? data : undefined), [library, data, enabled]);
}
