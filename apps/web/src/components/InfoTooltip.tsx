import { type ReactNode } from 'react';
import { useTapReveal } from '../lib/useTapReveal.js';
import styles from './InfoTooltip.module.css';

/** A small "i" trigger that reveals extra description/flavor text authored in the library but
 *  not otherwise rendered on the sheet (a Virtue's Essence and "use it when..." text, an Armor
 *  Type's description, ...). Tap-to-reveal rather than a native `title` tooltip, since `title`
 *  never shows on a touch device and this app is touch-first. */
export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const { open, setOpen, ref } = useTapReveal<HTMLSpanElement>();

  return (
    <span className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`tap ${styles.trigger}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`More about ${label}`}
      >
        i
      </button>
      {open && (
        <span className={styles.bubble} role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}

/** A labeled paragraph inside an InfoTooltip's body — "Essence: ..." / "Use it when...: ...". */
export function TooltipSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className={styles.bubbleLabel}>{label}</span>
      {children}
    </p>
  );
}
