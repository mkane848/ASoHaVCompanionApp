import styles from './PendingBondBadge.module.css';

/** A small count badge for Bonds with a change awaiting the viewer's own confirmation — visible
 *  next to a section heading rather than only inside each Bond's own card, so it reads even
 *  before opening the section (or, on the sheet, while the Advancement panel is collapsed). */
export function PendingBondBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    // Visible text rather than a hover-only title, which never shows on touch (iPad review I-10).
    <span className={styles.badge} aria-label={`${count} Bond ${count === 1 ? 'change is' : 'changes are'} awaiting your confirmation`}>
      <span aria-hidden>{count} to confirm</span>
    </span>
  );
}
