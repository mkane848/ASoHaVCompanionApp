import type { ReactNode } from 'react';

/** Work Together (revised V0.6 slice 8, an Adventure Move): "the GM may ask for the Party to make a
 *  single Hero Roll … Each Hero may contribute one relevant Skill Tag … Any or all of the Party Tags
 *  may be used as well … All Hero's Flaw Tags may affect this roll as well." The roller's own tags
 *  and the Party Tags have their own sections; this one adds the other Heroes' — +1 for each Hero
 *  contributing a Skill Tag, −1 for each of their Flaw Tags that applies — inside the ±3 cap.
 *  Stub until WP 8E. */
export interface WorkTogetherSectionProps {
  /** The other Heroes in the Party, by name. The section renders nothing when this is empty. */
  otherHeroNames: string[];
  /** Whether this roll is the Party's single Work Together roll. Off by default. */
  active: boolean;
  onToggleActive: () => void;
  /** The other Heroes contributing a Skill Tag, by name — +1 each, at most one per Hero. */
  contributors: ReadonlySet<string>;
  onToggleContributor: (name: string) => void;
  /** How many of the other Heroes' Flaw Tags affect the roll — −1 each. */
  otherFlawTags: number;
  onOtherFlawTagsChange: (count: number) => void;
}

export function WorkTogetherSection(_props: WorkTogetherSectionProps): ReactNode {
  throw new Error('not implemented: WP-8E');
}
