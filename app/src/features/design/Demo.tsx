import type { ReactNode } from 'react';
import styles from './Demo.module.css';

interface DemoProps {
  label: string;
  children: ReactNode;
}

/** Строка на странице компонентов: подпись слева, примеры справа. */
export function Demo({ label, children }: DemoProps) {
  return (
    <div className={styles.demo}>
      <p className={styles.label}>{label}</p>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
