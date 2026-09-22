import styles from './TrackStepper.module.css';

/** A compact counter for Potential (5), Act Breaks (3) and Forsakes (3). Deliberately does NOT
 *  use `Pips`: that component carries a 44px-tall absolute tap overlay (layout.css's `.pip::after`)
 *  built for the Status row, and stacking several of them in a dense Motif card would make their
 *  overlays bleed into the text fields above and into each other. Plain 44×44 buttons around
 *  read-only dots keep the tap targets real without any overlay geometry to collide. */
export function TrackStepper({ label, value, max, color, onSet }: { label: string; value: number; max: number; color: string; onSet: (n: number) => void }) {
  return (
    <div className={styles.track}>
      <span className={styles.trackLabel}>{label}</span>
      <div className={styles.stepper}>
        <button type="button" className={styles.stepperBtn} disabled={value <= 0} aria-label={`${label}: decrease`} onClick={() => onSet(Math.max(0, value - 1))}>−</button>
        <div className={styles.stepperDots} aria-hidden="true">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={i < value ? styles.dotOn : styles.dotOff} style={i < value ? { borderColor: color, background: color } : undefined} />
          ))}
        </div>
        <button type="button" className={styles.stepperBtn} disabled={value >= max} aria-label={`${label}: increase`} onClick={() => onSet(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}
