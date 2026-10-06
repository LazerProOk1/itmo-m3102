import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
import styles from './controls.module.css';

interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
}

/** Многострочное поле ввода. */
export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return <textarea className={cn(styles.control, styles.textarea, className)} aria-invalid={invalid || undefined} {...rest} />;
}
