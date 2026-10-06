import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
import styles from './controls.module.css';

interface InputProps extends ComponentProps<'input'> {
  /** Иконка Lucide внутри поля слева */
  icon?: LucideIcon;
  /** Подсветить поле как ошибочное */
  invalid?: boolean;
}

/** Однострочное поле ввода. Подходит для текста, даты, времени. */
export function Input({ icon: Icon, invalid, className, ...rest }: InputProps) {
  return (
    <div className={cn(styles.wrapper, className)}>
      {Icon && <Icon size={14} strokeWidth={1.75} className={styles.leadingIcon} aria-hidden />}
      <input className={cn(styles.control, Icon && styles.withIcon)} aria-invalid={invalid || undefined} {...rest} />
    </div>
  );
}
