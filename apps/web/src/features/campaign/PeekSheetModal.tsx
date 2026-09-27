import type { CampaignBootstrap, Character, CharacterSheet, Library } from '@asohav/shared';

/** STUB (Wave 0 contract) — agent B replaces the body. The GM's read-only view of one player's
 *  sheet, opened from that player's PeekCard. Data comes from `boot.peekSheets` (GM-only, already
 *  sent by the bootstrap route), so no new request is made. */
export function PeekSheetModal(props: {
  character: Character;
  sheet: CharacterSheet;
  boot: CampaignBootstrap;
  library: Library;
  onClose: () => void;
}) {
  void props;
  return null;
}
