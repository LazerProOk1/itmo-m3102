import type { ReactNode } from 'react';
import styles from './settings.module.css';

interface SettingsRowProps {
  label: string;
  description?: string;
  /** id поля справа — тогда клик по названию ставит в него курсор */
  htmlFor?: string;
  children: ReactNode;
}

/** Строка настроек: название и пояснение слева, элемент управления справа. */
export function SettingsRow({ label, description, htmlFor, children }: SettingsRowProps) {
  return (
    <div className={styles.row}>
      <div>
        {htmlFor ? (
          <label htmlFor={htmlFor} className={styles.label}>
            {label}
          </label>
        ) : (
          <p className={styles.label}>{label}</p>
        )}
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
