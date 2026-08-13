import type { Ref, SelectHTMLAttributes } from 'react';
import styles from './field.module.css';

export function Select({ ref, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select ref={ref} className={`${styles.select} ${className ?? ''}`} {...props} />;
}
