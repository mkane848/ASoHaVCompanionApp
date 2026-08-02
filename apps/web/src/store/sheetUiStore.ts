import { create } from 'zustand';
import type { PickerState } from '../features/sheet/pickerTypes.js';

interface SheetUiState {
  drawerOpen: boolean;
  moveQuery: string;
  picker: PickerState;
  saveNote: string;
  toggleDrawer: () => void;
  closeDrawer: () => void;
  setMoveQuery: (q: string) => void;
  openPicker: (p: PickerState) => void;
  closePicker: () => void;
  setSaveNote: (n: string) => void;
}

/** Sheet-screen local/UI state — open panel, Moves drawer + search, picker open + selection.
 *  Server data (the sheet itself, party, bonds) lives in TanStack Query, not here. */
export const useSheetUiStore = create<SheetUiState>((set) => ({
  drawerOpen: false,
  moveQuery: '',
  picker: null,
  saveNote: '',
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  closeDrawer: () => set({ drawerOpen: false }),
  setMoveQuery: (moveQuery) => set({ moveQuery }),
  openPicker: (picker) => set({ picker }),
  closePicker: () => set({ picker: null }),
  setSaveNote: (saveNote) => set({ saveNote }),
}));
