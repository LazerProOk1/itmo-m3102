import type { ReactNode } from 'react';
import styles from './settings.module.css';

interface SettingsRowProps {
  label: string;
  description?: string;
  /** id поля справа — тогда клик по названию ставит в него курсор */
  htmlFor?: string;
  /** Строка сейчас не действует (например, пару акцентов ведёт динамическая тема): тускнеет, не нажимается, под описанием — пояснение */
  lockedNote?: string;
  children: ReactNode;
}

/** Строка настроек: название и пояснение слева, элемент управления справа. */
export function SettingsRow({ label, description, htmlFor, lockedNote, children }: SettingsRowProps) {
  return (
    <div className={lockedNote ? `${styles.row} ${styles.locked}` : styles.row}>
      <div>
        {htmlFor ? (
          <label htmlFor={htmlFor} className={styles.label}>
            {label}
          </label>
        ) : (
          <p className={styles.label}>{label}</p>
        )}
        {description && <p className={styles.description}>{description}</p>}
        {lockedNote && <p className={styles.lockedNote}>{lockedNote}</p>}
      </div>
      <div className={styles.control} inert={lockedNote ? true : undefined}>
        {children}
      </div>
    </div>
  );
}
