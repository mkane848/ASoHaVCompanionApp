/** The switchable UI appearance system (WorkPlan-0.26.0). Named "Appearance", never "Theme" —
 *  a UI theme called `Theme` would make `grep -rn theme` useless in a repo whose working convention is
 *  "read the code before changing it." See CLAUDE.md's "Architecture: appearances" and
 *  docs/decisions.md for the full naming writeup. */
export type AppearanceId = 'parchment' | 'noticeboard';

export interface AppearanceDef {
  id: AppearanceId;
  label: string;
}

/** Order here is display order in the picker (AppShell.tsx). */
export const APPEARANCES: AppearanceDef[] = [
  { id: 'parchment', label: 'Parchment' },
  { id: 'noticeboard', label: 'Notice Board' },
];

/** Notice Board became the default in `0.39.0` (`WorkPlan-0.39.0.md` item 1) — see
 *  `appearanceStore.ts`'s `KEY` comment for how the storage-key rename delivers the one-time
 *  forced reset with no migration logic. */
export const DEFAULT_APPEARANCE: AppearanceId = 'noticeboard';

export function isAppearanceId(value: string): value is AppearanceId {
  return APPEARANCES.some((a) => a.id === value);
}
