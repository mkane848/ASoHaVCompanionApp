import { create } from 'zustand';

interface SheetUiState {
  drawerOpen: boolean;
  moveQuery: string;
  /** null = "All". Otherwise a Virtue Id, or 'adventure' / 'any' for moves with no Virtue tie. */
  moveVirtueFilter: string | null;
  saveNote: string;
  toggleDrawer: () => void;
  closeDrawer: () => void;
  setMoveQuery: (q: string) => void;
  setMoveVirtueFilter: (v: string | null) => void;
  setSaveNote: (n: string) => void;
}

/** Sheet-screen local/UI state — open panel, Moves drawer + search.
 *  Server data (the sheet itself, party, bonds) lives in TanStack Query, not here. */
export const useSheetUiStore = create<SheetUiState>((set) => ({
  drawerOpen: false,
  moveQuery: '',
  moveVirtueFilter: null,
  saveNote: '',
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  closeDrawer: () => set({ drawerOpen: false }),
  setMoveQuery: (moveQuery) => set({ moveQuery }),
  setMoveVirtueFilter: (moveVirtueFilter) => set({ moveVirtueFilter }),
  setSaveNote: (saveNote) => set({ saveNote }),
}));
