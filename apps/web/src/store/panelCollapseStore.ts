import { create } from 'zustand';

const KEY = 'asohav.collapsedPanels';

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    // Private mode, disabled storage, or a value someone else wrote. A panel
    // that forgets it was collapsed is a much smaller problem than a sheet that
    // won't render, so swallow it and start from "everything open".
    return {};
  }
}

function save(state: Record<string, boolean>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* see load() */
  }
}

interface PanelCollapseState {
  collapsed: Record<string, boolean>;
  toggle: (id: string) => void;
  setAll: (ids: string[], collapsed: boolean) => void;
}

/** Which sheet panels the player has folded away, persisted across sessions.
 *  Purely presentational, so it lives in localStorage rather than on the sheet —
 *  a player's folded panels shouldn't sync to their GM's peek view. */
export const usePanelCollapseStore = create<PanelCollapseState>((set) => ({
  collapsed: load(),
  toggle: (id) =>
    set((s) => {
      const collapsed = { ...s.collapsed, [id]: !s.collapsed[id] };
      save(collapsed);
      return { collapsed };
    }),
  setAll: (ids, value) =>
    set((s) => {
      const collapsed = { ...s.collapsed };
      for (const id of ids) collapsed[id] = value;
      save(collapsed);
      return { collapsed };
    }),
}));
