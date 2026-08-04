import styles from './PendingBondBadge.module.css';

/** A small count badge for Bonds with a change awaiting the viewer's own confirmation — visible
 *  next to a section heading rather than only inside each Bond's own card, so it reads even
 *  before opening the section (or, on the sheet, while the Advancement panel is collapsed). */
export function PendingBondBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className={styles.badge} title={`${count} Bond ${count === 1 ? 'change is' : 'changes are'} awaiting your confirmation`}>
      {count}
    </span>
  );
}
