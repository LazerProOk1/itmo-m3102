import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { sparkFrom } from '../../lib/celebrate';
import { cn } from '../../lib/cn';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  /** Текст рядом с чекбоксом. Если его нет — передайте aria-label */
  label?: ReactNode;
  /** Отметка «сделано»: при включении — искры от галочки (lib/celebrate.ts) */
  celebrate?: boolean;
}

/**
 * Чекбокс. Внутри — настоящий <input type="checkbox">, скрытый визуально,
 * поэтому клавиатура и скринридеры работают как обычно.
 */
export function Checkbox({ label, className, celebrate = false, onChange, ...rest }: CheckboxProps) {
  const handleChange: CheckboxProps['onChange'] = (event) => {
    if (celebrate && event.target.checked) sparkFrom(event.target);
    onChange?.(event);
  };
  return (
    <label className={cn(styles.root, className)}>
      <input type="checkbox" className={styles.input} onChange={handleChange} {...rest} />
      <span className={styles.box} aria-hidden>
        <Check size={12} strokeWidth={3} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
