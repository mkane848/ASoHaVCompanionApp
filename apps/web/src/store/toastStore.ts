import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (message: string) => void;
  dismiss: () => void;
}

/** Global transient-notification surface, mounted once in AppShell — lets code outside the
 *  component tree (a TanStack Query mutation's onError, for one) raise a Toast without its
 *  caller needing to own toast state itself. Pure UI state, same category as this app's other
 *  zustand stores. */
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  dismiss: () => set({ message: null }),
}));
