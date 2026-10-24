import type { CampaignBootstrap, Character, HeroLifeState } from '@asohav/shared';

// Replacement Hero (our interpretation, docs/decisions.md). The slot is `Party.ReplacementHeroFor`, a
// UserId; these pure helpers decide what each surface shows. The server is the authority.

/** The viewer's current Hero. A Player who has had a replacement owns several Characters, so this
 *  follows the membership's pointer rather than "the first Character with my UserId". */
export function myCurrentCharacter(boot: CampaignBootstrap): Character | undefined {
  const id = boot.membership.CharacterId;
  return id ? boot.characters.find((c) => c.Id === id) : undefined;
}

/** True when the GM has opened replacement-Hero creation for the viewer. */
export function replacementOpenForMe(boot: CampaignBootstrap): boolean {
  return boot.membership.Role === 'Player' && !!boot.membership.CharacterId && boot.party.ReplacementHeroFor === boot.membership.UserId;
}

export type GmReplacementState = 'none' | 'offer' | 'open' | 'blocked';

/** What the GM sees on one Hero card: nothing (alive, a past Hero, or not a Player's current Hero),
 *  an offer to open, the open slot (cancellable), or `blocked` because another player's slot is open. */
export function gmReplacementState(boot: CampaignBootstrap, characterId: string, lifeState: HeroLifeState | undefined): GmReplacementState {
  if (lifeState !== 'Dead' && lifeState !== 'Retired') return 'none';
  const member = boot.members.find((m) => m.Role === 'Player' && m.CharacterId === characterId);
  if (!member) return 'none';
  const open = boot.party.ReplacementHeroFor ?? null;
  if (open === member.UserId) return 'open';
  return open ? 'blocked' : 'offer';
}
