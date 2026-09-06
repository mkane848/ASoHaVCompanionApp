import type { CampaignPhase } from '@asohav/shared';

/** Shared with `CampaignPage.tsx`'s phase badge and `CampaignTile.tsx`'s Home-tile badge
 *  (0.38.0 item 6) — lifted out of `CampaignPage.tsx` rather than left as a second copy. See
 *  CLAUDE.md's note on `AdvancementPanel`/`CampaignBonds` each carrying their own `TYPE_LABELS`
 *  for what happens when a label map gets duplicated instead. */
export const PHASE_LABEL: Record<CampaignPhase, string> = {
  Signup: 'Signup open',
  PartyCreation: 'Party creation',
  Playing: 'Playing',
};
