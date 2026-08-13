import type { ReactNode } from 'react';
import styles from './field.module.css';

/** A tappable checkbox row — a real button (not a native `<input type="checkbox">`, which this
 *  app never uses; see VirtuesPanel.tsx's Condition toggle for the same pattern) sized with a
 *  genuine 44px min-height rather than a `.tap` overlay, since these stack tightly in a vertical
 *  list and an overlay would bleed into neighboring rows. Promoted from CreateCharacterPage.tsx's
 *  local version (0.23.0) to a shared primitive — CSS unchanged, just relocated. */
export function CheckboxRow({
  checked,
  disabled,
  onToggle,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={`${styles.checkboxRow} ${disabled ? styles.checkboxRowDisabled : ''}`}
      onClick={onToggle}
    >
      <span className={`${styles.checkGlyph} ${checked ? styles.checkGlyphMarked : ''}`} aria-hidden>
        {checked ? '✓' : ''}
      </span>
      <span className={styles.checkLabel}>{children}</span>
    </button>
  );
}
