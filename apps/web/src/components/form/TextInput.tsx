import type { InputHTMLAttributes, Ref } from 'react';
import styles from './field.module.css';

/** Accepts `ref` as a plain prop (React 19 — see the vercel-composition-patterns skill's
 *  react19-no-forwardref rule) so `register()`'s returned `ref` spreads straight through for an
 *  uncontrolled react-hook-form field, same as a bare `<input>` would. */
export function TextInput({ ref, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={`${styles.input} ${className ?? ''}`} {...props} />;
}
