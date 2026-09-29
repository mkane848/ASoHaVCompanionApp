import { useId, type ReactNode } from 'react';
import { usePanelCollapseStore } from '../store/panelCollapseStore.js';
import styles from './SectionHead.module.css';

/** The "heading + gradient rule, with optional trailing content" treatment used wherever a page
 *  or panel introduces a named section — CampaignPage's "The party"/"Combat"/"Invites" and, as of
 *  0.23.0 when Combat moved inline (see CLAUDE.md's Combat architecture note), EncounterView's own
 *  sub-sections (Incoming/Reactions/Interpose/Defiant Goals/Party/Enemies), which render on the
 *  same screen now and had two independently hand-rolled versions of this same pattern before.
 *  `size="sm"` is an h3 at EncounterView's existing sub-section weight (nested one level inside a
 *  page-level section, so it stays visually subordinate to it); the default `"lg"` is CampaignPage's
 *  h2. `spaced` matches CampaignPage's old `.sectionHeadSpaced` — extra top margin for a section
 *  that isn't the first one on the page.
 *
 *  `collapseId` opts into folding (the repo owner asked to collapse CampaignPage's sections the
 *  way the sheet's panels already fold): SectionHead then wraps the head row *and* `children`, and
 *  the title becomes the toggle. The open/closed state persists in the same store as the sheet's
 *  Panels, keyed by `collapseId`. Without it this renders exactly the bare head row it always has
 *  (with any `children` simply following it), so every non-folding caller is untouched. */
export function SectionHead({
  title,
  size = 'lg',
  spaced,
  extra,
  collapseId,
  children,
}: {
  title: string;
  size?: 'lg' | 'sm';
  spaced?: boolean;
  extra?: ReactNode;
  collapseId?: string;
  children?: ReactNode;
}) {
  // Selects this section's one boolean rather than the whole map, so folding one section doesn't
  // re-render every other SectionHead on the page — and a non-folding one never re-renders at all.
  const collapsed = usePanelCollapseStore((s) => !!collapseId && !!s.collapsed[collapseId]);
  const toggle = usePanelCollapseStore((s) => s.toggle);
  const bodyId = useId();
  const Heading = size === 'sm' ? 'h3' : 'h2';
  const headClass = [styles.head, size === 'sm' ? styles.sm : '', spaced ? styles.spaced : ''].filter(Boolean).join(' ');

  if (!collapseId) {
    return (
      <>
        <div className={headClass}>
          <Heading className={styles.title}>{title}</Heading>
          <div className={styles.rule} />
          {extra}
        </div>
        {children}
      </>
    );
  }

  return (
    <div>
      <div className={headClass}>
        {/* The button sits inside the heading, not around it the way PanelHeader's does: a button's
            content is presentational to assistive tech, so wrapping the heading would drop these
            page-level sections out of heading navigation. `extra` stays outside the button so
            anything interactive in it keeps its own click. */}
        <Heading className={styles.title}>
          <button
            type="button"
            className={`tap-inline ${styles.toggle}`}
            onClick={() => toggle(collapseId)}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
          >
            <span aria-hidden className={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ''}`}>
              ▾
            </span>
            {title}
          </button>
        </Heading>
        <div className={styles.rule} />
        {extra}
      </div>
      {/* Hidden rather than unmounted, same as a folded Panel: folding a section shouldn't throw
          away a half-filled New Clock or invite form inside it. */}
      <div id={bodyId} hidden={collapsed}>
        {children}
      </div>
    </div>
  );
}
