import { create } from 'zustand';
import type { AdminView } from '../features/admin/AdminNav.js';

interface AdminUiState {
  view: AdminView;
  selectedId: string | null;
  draft: Record<string, any> | null;
  jsonTexts: Record<string, string>;
  note: string;
  setView: (v: AdminView) => void;
  selectObject: (id: string, obj: Record<string, any> | null) => void;
  createNew: (initial: Record<string, any>) => void;
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
  jsonTexts: {},
  note: '',
  setView: (view) => set({ view, selectedId: null, draft: null, jsonTexts: {} }),
  selectObject: (selectedId, obj) => set({ selectedId, draft: obj ? structuredClone(obj) : null, jsonTexts: {} }),
  createNew: (initial) => set({ selectedId: null, draft: initial, jsonTexts: {} }),
  setDraftField: (name, value) => set((s) => (s.draft ? { draft: { ...s.draft, [name]: value } } : s)),
  setDraft: (draft) => set({ draft, jsonTexts: {} }),
  setJsonText: (name, text) => set((s) => ({ jsonTexts: { ...s.jsonTexts, [name]: text } })),
  clearJsonTexts: () => set({ jsonTexts: {} }),
  setNote: (note) => set({ note }),
}));
