import type { ReactNode } from 'react';
import styles from './DisabledHint.module.css';

/** Why a button is disabled, as visible text. The button names it in `aria-describedby`; a hover
 *  `title` never shows on touch (see `useTapReveal`). Same look as the sheet's `PlayLockedNote`. */
export function DisabledHint({ id, className = '', children }: { id: string; className?: string; children: ReactNode }) {
  return <p id={id} className={`${styles.hint} ${className}`}>{children}</p>;
}
