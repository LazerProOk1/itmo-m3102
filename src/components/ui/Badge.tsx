import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import styles from './Badge.module.css';

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'lecture'
  | 'practice'
  | 'lab'
  | 'consultation';

interface BadgeProps {
  tone?: BadgeTone;
  /** Точка перед текстом — например, для легенды календаря */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

/** Короткая метка: приоритет, статус, «in 42 min». */
export function Badge({ tone = 'neutral', dot = false, children, className }: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}
