import type { ReactNode } from 'react';
import styles from './field.module.css';

/** A form-field label, paired via `htmlFor`/`id` with whatever control is passed as `children` —
 *  the same separate-`<label>`-then-`<input>` sibling structure the five modals sharing this
 *  style already used, not a wrapping `<label>` around both (see TextInput/Select/NumberInput). */
export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </>
  );
}
