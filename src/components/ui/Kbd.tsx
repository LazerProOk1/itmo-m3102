import type { ReactNode } from 'react';
import styles from './Kbd.module.css';

interface KbdProps {
  children: ReactNode;
}

/** Подсказка с клавишей: Ctrl K, Esc. */
export function Kbd({ children }: KbdProps) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
