import { create } from 'zustand';

export type ToastTone = 'error' | 'status';

interface ToastState {
  message: string | null;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  dismiss: () => void;
}

/** Global transient-notification surface, mounted once in AppShell — lets code outside the
 *  component tree (a TanStack Query mutation's onError, a Realtime-driven announcement) raise a
 *  Toast without its caller needing to own toast state itself. Pure UI state, same category as
 *  this app's other zustand stores. `tone` defaults to 'error' since that's what every call site
 *  before 0.23.0 meant; pass 'status' for a neutral, non-failure announcement (see Toast.tsx). */
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: 'error',
  show: (message, tone = 'error') => set({ message, tone }),
  dismiss: () => set({ message: null }),
}));
