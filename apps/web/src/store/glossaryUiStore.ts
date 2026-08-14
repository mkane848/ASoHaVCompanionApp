import { create } from 'zustand';

interface GlossaryUiState {
  open: boolean;
  /** Which term to scroll the list to on open — set by a "See also" chip elsewhere in the app
   *  (InfoTooltip/GlossaryText); null for the plain sheet/Campaign header triggers, which just
   *  open at the top of the (alphabetical) list. */
  initialTermId: string | null;
  query: string;
  openDrawer: (termId?: string | null) => void;
  closeDrawer: () => void;
  setQuery: (q: string) => void;
}

/** The Glossary drawer's own store rather than an addition to sheetUiStore (0.25.0) — the
 *  Campaign page is not the sheet, and this drawer is triggered from both. */
export const useGlossaryUiStore = create<GlossaryUiState>((set) => ({
  open: false,
  initialTermId: null,
  query: '',
  // Clears any stale search text on open so a term targeted via `termId` (a "See also" chip) is
  // never hidden by a filter left over from the drawer's last use.
  openDrawer: (termId = null) => set({ open: true, initialTermId: termId, query: '' }),
  closeDrawer: () => set({ open: false, initialTermId: null }),
  setQuery: (query) => set({ query }),
}));
