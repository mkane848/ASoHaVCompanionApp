import { create } from 'zustand';
import type { AdminView } from '../features/admin/AdminNav.js';

interface AdminUiState {
  view: AdminView;
  selectedId: string | null;
  draft: Record<string, any> | null;
  /** The draft exactly as it was loaded, for the dirty check below. Never edited — `setDraftField`
   *  touches `draft` alone — so the two diverge the moment the admin types. */
  pristine: Record<string, any> | null;
  jsonTexts: Record<string, string>;
  note: string;
  setView: (v: AdminView) => void;
  selectObject: (id: string, obj: Record<string, any> | null) => void;
  createNew: (initial: Record<string, any>) => void;
  duplicateDraft: () => void;
  setDraftField: (name: string, value: unknown) => void;
  setDraft: (draft: Record<string, any> | null) => void;
  setJsonText: (name: string, text: string) => void;
  clearJsonTexts: () => void;
  setNote: (note: string) => void;
}

/** Admin-panel local/UI state — which collection/tool is showing, the draft object being
 *  edited (dirty until Save), and pending raw text for JSON fields. The library itself is
 *  server state and lives in TanStack Query. */
export const useAdminUiStore = create<AdminUiState>((set) => ({
  view: 'virtues',
  selectedId: null,
  draft: null,
  pristine: null,
  jsonTexts: {},
  note: '',
  setView: (view) => set({ view, selectedId: null, draft: null, pristine: null, jsonTexts: {} }),
  selectObject: (selectedId, obj) =>
    set({ selectedId, draft: obj ? structuredClone(obj) : null, pristine: obj ? structuredClone(obj) : null, jsonTexts: {} }),
  // A brand-new record's pristine is its seeded shape, so typing the first character makes it
  // dirty — abandoning a half-filled new record warns exactly like abandoning an edit.
  createNew: (initial) => set({ selectedId: null, draft: initial, pristine: structuredClone(initial), jsonTexts: {} }),
  /* Duplicate copies the record *as saved*, not as currently edited — so the caller can put it
     behind the same unsaved-changes guard as any other navigation, and "discard and leave" means
     the same thing here as everywhere else. `pristine` is deliberately left null rather than
     cloned: a pre-filled copy has real content to lose, unlike an empty New record, so it has to
     read as dirty from the moment it appears. */
  duplicateDraft: () =>
    set((s) => {
      const source = s.pristine ?? s.draft;
      if (!source) return s;
      const copy = structuredClone(source);
      delete copy.Id;
      copy.Name = source.Name ? `${source.Name} (copy)` : '';
      return {
        selectedId: null,
        draft: copy,
        pristine: null,
        jsonTexts: {},
      };
    }),
  setDraftField: (name, value) => set((s) => (s.draft ? { draft: { ...s.draft, [name]: value } } : s)),
  // Called with the server's own returned object after a save, so this is also what marks the
  // draft clean again.
  setDraft: (draft) => set({ draft, pristine: draft ? structuredClone(draft) : null, jsonTexts: {} }),
  setJsonText: (name, text) => set((s) => ({ jsonTexts: { ...s.jsonTexts, [name]: text } })),
  clearJsonTexts: () => set({ jsonTexts: {} }),
  setNote: (note) => set({ note }),
}));

/** Whether the open draft has unsaved changes.
 *
 *  `selectObject`/`setView` overwrote `draft` unconditionally until 0.51.0, so clicking another
 *  record — or another collection, or the browser's back button — silently threw away whatever
 *  you had typed, with no warning and no way to get it back.
 *
 *  A pending `jsonTexts` entry counts as dirty on its own: raw JSON text is held separately from
 *  `draft` and only parsed into it at save time, so a half-typed JSON field would otherwise look
 *  clean. Compared by serialisation rather than by reference because `setDraftField` rebuilds the
 *  object on every keystroke — a reference check would call every draft dirty, including one typed
 *  back to its original value. */
export function isDraftDirty(state: Pick<AdminUiState, 'draft' | 'pristine' | 'jsonTexts'>): boolean {
  if (Object.keys(state.jsonTexts).length > 0) return true;
  if (!state.draft && !state.pristine) return false;
  return JSON.stringify(state.draft) !== JSON.stringify(state.pristine);
}
