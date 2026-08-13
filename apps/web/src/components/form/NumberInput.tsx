import type { InputHTMLAttributes, Ref } from 'react';
import styles from './field.module.css';

/** Same box as TextInput (the modal `.input` treatment doesn't vary by type), just defaulted to
 *  `type="number"`. */
export function NumberInput({ ref, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} type="number" className={`${styles.input} ${className ?? ''}`} {...props} />;
}
