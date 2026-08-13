import type { ReactNode } from 'react';
import styles from './SectionHead.module.css';

/** The "heading + gradient rule, with optional trailing content" treatment used wherever a page
 *  or panel introduces a named section — CampaignPage's "The party"/"Combat"/"Invites" and, as of
 *  0.23.0 when Combat moved inline (see CLAUDE.md's Combat architecture note), EncounterView's own
 *  sub-sections (Incoming/Reactions/Interpose/Defiant Goals/Party/Enemies), which render on the
 *  same screen now and had two independently hand-rolled versions of this same pattern before.
 *  `size="sm"` is an h3 at EncounterView's existing sub-section weight (nested one level inside a
 *  page-level section, so it stays visually subordinate to it); the default `"lg"` is CampaignPage's
 *  h2. `spaced` matches CampaignPage's old `.sectionHeadSpaced` — extra top margin for a section
 *  that isn't the first one on the page. */
export function SectionHead({ title, size = 'lg', spaced, extra }: { title: string; size?: 'lg' | 'sm'; spaced?: boolean; extra?: ReactNode }) {
  const Heading = size === 'sm' ? 'h3' : 'h2';
  return (
    <div className={[styles.head, size === 'sm' ? styles.sm : '', spaced ? styles.spaced : ''].filter(Boolean).join(' ')}>
      <Heading className={styles.title}>{title}</Heading>
      <div className={styles.rule} />
      {extra}
    </div>
  );
}
