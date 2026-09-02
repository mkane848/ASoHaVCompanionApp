/** The party-Rapport 'advancement' kind retired in slice 4 — a full Rapport track now clears
 *  itself via `ConfirmModal` inline in `AdvancementPanel.tsx`/`EndSessionModal.tsx` rather than
 *  opening a picker, since there's no Party Improvement content to choose from yet (see
 *  HANDOFF.md open issue 12). Only the Bond-forge writer is left. */
export type PickerState = { kind: 'bond'; bondId: string; partnerName: string } | null;
