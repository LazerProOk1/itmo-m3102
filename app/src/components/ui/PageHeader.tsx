import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  /** Короткая строка под заголовком, например «Week 3 · Odd week» */
  subtitle?: ReactNode;
  /** Кнопки справа от заголовка */
  actions?: ReactNode;
  /**
   * Разворачивает заголовок слева направо при монтировании (clip-path, 450ms).
   * Только для действительно важных заголовков (страница предмета) — вызывающая
   * страница сама решает, было ли это уже показано за сессию, и не передаёт true повторно.
   */
  reveal?: boolean;
}

/** Заголовок страницы. Одинаковый на всех страницах. */
export function PageHeader({ title, subtitle, actions, reveal = false }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {/* data-morph-target — сюда перетекает заголовок карточки (lib/morph.ts) */}
        <h1 className={cn(styles.title, reveal && styles.reveal)} data-morph-target>
          {title}
        </h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
