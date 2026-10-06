import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import styles from './Field.module.css';

interface FieldProps {
  label: string;
  /** id поля ввода — тогда клик по подписи ставит в него курсор */
  htmlFor?: string;
  hint?: string;
  /** Текст ошибки. Если есть — показывается вместо подсказки */
  error?: string;
  /** Показать пометку «Необязательно» */
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

/** Подпись + поле ввода + подсказка или ошибка. */
export function Field({ label, htmlFor, hint, error, optional = false, children, className }: FieldProps) {
  const labelContent = (
    <>
      {label}
      {optional && <span className={styles.optional}>Необязательно</span>}
    </>
  );

  return (
    <div className={cn(styles.field, className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={styles.label}>
          {labelContent}
        </label>
      ) : (
        <span className={styles.label}>{labelContent}</span>
      )}
      {children}
      {error ? <p className={styles.error}>{error}</p> : hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
