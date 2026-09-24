import { create } from 'zustand';

const KEY = 'asohav.debug';

/** Whether this browser has Debug mode on — read/write isolated the same way `appearanceStore.ts`
 *  does it, and failing closed: private mode, blocked storage or a stray value all read as off. */
export function loadDebug(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveDebug(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* see loadDebug() */
  }
}

interface DebugState {
  debug: boolean;
  setDebug: (on: boolean) => void;
}

/** Debug mode (revised V0.6 slice 9): an admin-panel toggle that turns on admin-only readouts such
 *  as the dice odds. Per browser, never on the server. Read it through `useDebugMode()`, which is
 *  what keeps it admin-only — this store alone says nothing about who is looking. */
export const useDebugStore = create<DebugState>((set) => ({
  debug: loadDebug(),
  setDebug: (debug) => {
    saveDebug(debug);
    set({ debug });
  },
}));
