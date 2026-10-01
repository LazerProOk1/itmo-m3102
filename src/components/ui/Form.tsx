import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import styles from './Form.module.css';

interface FormProps extends ComponentProps<'form'> {
  /** Отключает все поля формы разом — режим просмотра без возможности редактирования */
  disabled?: boolean;
}

/**
 * Форма с ровными отступами между полями.
 * noValidate: проверяем поля сами и показываем ошибки в стиле приложения.
 * disabled оборачивает поля в <fieldset disabled> — родная блокировка всех контролов разом,
 * без ручного disabled на каждом Input/Select/Textarea.
 */
export function Form({ className, disabled, children, ...rest }: FormProps) {
  return (
    <form className={cn(styles.form, className)} noValidate {...rest}>
      <fieldset disabled={disabled} className={styles.fieldset}>
        {children}
      </fieldset>
    </form>
  );
}

interface FormRowProps {
  children: ReactNode;
}

/** Два поля в одну строку (на узком экране — друг под другом). */
export function FormRow({ children }: FormRowProps) {
  return <div className={styles.row}>{children}</div>;
}
