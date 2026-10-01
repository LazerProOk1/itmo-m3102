import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  /** Текст рядом с чекбоксом. Если его нет — передайте aria-label */
  label?: ReactNode;
}

/**
 * Чекбокс. Внутри — настоящий <input type="checkbox">, скрытый визуально,
 * поэтому клавиатура и скринридеры работают как обычно.
 */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cn(styles.root, className)}>
      <input type="checkbox" className={styles.input} {...rest} />
      <span className={styles.box} aria-hidden>
        <Check size={12} strokeWidth={3} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
