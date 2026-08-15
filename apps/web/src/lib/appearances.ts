/** The switchable UI appearance system (WorkPlan-0.26.0). Named "Appearance", never "Theme" —
 *  `CharacterSheet.Theme`/`ThemePanel.tsx`/`library.themes` are an existing game concept, and a UI
 *  theme called `Theme` would make `grep -rn theme` useless in a repo whose working convention is
 *  "read the code before changing it." See CLAUDE.md's "Architecture: appearances" and
 *  README.md#architecture-notes--judgment-calls for the full naming writeup. */
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

export const DEFAULT_APPEARANCE: AppearanceId = 'parchment';

export function isAppearanceId(value: string): value is AppearanceId {
  return APPEARANCES.some((a) => a.id === value);
}
