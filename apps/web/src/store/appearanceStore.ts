import { create } from 'zustand';
import { DEFAULT_APPEARANCE, isAppearanceId, type AppearanceId } from '../lib/appearances.js';

// Renamed from 'asohav.appearance' in 0.39.0 (WorkPlan-0.39.0.md item 1) when Notice Board became
// the default — a key rename delivers the one-time forced reset with no marker/migration logic:
// nobody has this key yet, so everyone falls through to DEFAULT_APPEARANCE (now 'noticeboard') on
// first load after this shipped. Anyone who then picks Parchment writes this key and keeps it;
// anyone who had already chosen Notice Board is "reset" to Notice Board and sees no change. The
// old 'asohav.appearance' key is simply never read again — left in place rather than deleted,
// since an inline <head> script that deletes storage is more risk than a few dead bytes.
const KEY = 'asohav.appearance.v2';

/** Read/write isolated into their own functions (WorkPlan-0.26.0 decision 2) so a server-backed
 *  source can replace them later without touching a single call site. Kept in sync by hand with
 *  the same key name/default duplicated in index.html's and harness.html's inline no-flash
 *  script — that script can't import this module (see the script's own comment for why).
 *
 *  Checks `?appearance=` before localStorage, matching harness.html's own inline-script
 *  priority (WorkPlan-0.26.0 G) — the test harness navigates with this param to force an
 *  appearance deterministically for responsive-smoke.mjs/screenshot.mjs. Without this, the
 *  attribute-driven CSS would correctly follow the query param (the inline script sets it before
 *  paint) while this store's own state — and so the picker's displayed value — silently stayed
 *  on whatever localStorage said, a real mismatch a human reviewing screenshot.mjs's output would
 *  actually see. Harmless in the real app: index.html never receives this param.
 *
 *  Exported (alongside saveAppearance below) for direct unit testing (TechStackAudit.md D9/G12)
 *  — this file's own opening comment already isolated these for exactly this kind of
 *  replaceability, so testing them directly rather than only through the store's reactive
 *  surface fits the same design, not a change to it. */
export function loadAppearance(): AppearanceId {
  try {
    const qp = new URLSearchParams(location.search).get('appearance');
    if (qp && isAppearanceId(qp)) return qp;
    const raw = localStorage.getItem(KEY);
    return raw && isAppearanceId(raw) ? raw : DEFAULT_APPEARANCE;
  } catch {
    // Private mode, disabled storage, or a value someone else wrote. Same trade
    // panelCollapseStore.ts already documents — falling back to the default appearance
    // is a much smaller problem than a sheet that won't render.
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(id: AppearanceId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* see loadAppearance() */
  }
}

interface AppearanceState {
  appearance: AppearanceId;
  setAppearance: (id: AppearanceId) => void;
}

/** Which appearance (Parchment/Notice Board) the player has chosen, persisted across sessions.
 *  The store does not own the *initial* paint — index.html/harness.html's inline <head> script
 *  already sets `document.documentElement.dataset.appearance` from the same localStorage key
 *  before first paint, so the app never flashes Parchment and repaints. `setAppearance` is what
 *  applies the attribute for every *subsequent* switch, made from the picker in AppShell.tsx. */
export const useAppearanceStore = create<AppearanceState>((set) => ({
  appearance: loadAppearance(),
  setAppearance: (id) => {
    saveAppearance(id);
    document.documentElement.dataset.appearance = id;
    set({ appearance: id });
  },
}));
