import { campaignPhase, type Campaign, type CampaignPhase } from '@asohav/shared';

/** Shared with `CampaignPage.tsx`'s phase badge and `CampaignTile.tsx`'s Home-tile badge
 *  (0.38.0 item 6) — lifted out of `CampaignPage.tsx` rather than left as a second copy. See
 *  CLAUDE.md's note on `AdvancementPanel`/`CampaignBonds` each carrying their own `TYPE_LABELS`
 *  for what happens when a label map gets duplicated instead. */
export const PHASE_LABEL: Record<CampaignPhase, string> = {
  Signup: 'Signup open',
  PartyCreation: 'Party creation',
  Playing: 'Playing',
};

/** Shown beside every play action the current phase doesn't allow yet (a roll, Camp, End the
 *  Session, Misfortune…) — one string so every disabled control explains itself the same way. */
export const PLAY_LOCKED_HINT = 'Available once the GM starts play.';

/** Play actions (rolling, Camp, sessions, Misfortune, Rapport) exist only once the GM has moved
 *  the campaign to Playing. Reads through `campaignPhase()`, so a legacy campaign with no stored
 *  Phase counts as Party Creation, same as everywhere else. */
export function isPlaying(campaign: Campaign): boolean {
  return campaignPhase(campaign) === 'Playing';
}
