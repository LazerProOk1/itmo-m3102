import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import styles from './Section.module.css';

interface SectionProps {
  /** Короткий заголовок — показывается мелкими заглавными буквами */
  title: string;
  /** Число или короткий текст рядом с заголовком */
  meta?: ReactNode;
  /** Ссылка или кнопка справа */
  action?: ReactNode;
  /** danger — для срочных групп вроде просроченных задач. Только цвет заголовка, без рамок и фона. */
  tone?: 'neutral' | 'danger';
  children: ReactNode;
  className?: string;
}

/** Блок страницы: заголовок и тонкая линия. Разделяет контент без карточек. */
export function Section({ title, meta, action, tone = 'neutral', children, className }: SectionProps) {
  return (
    <section className={cn(styles.section, className)}>
      <header className={styles.header}>
        <h2 className={cn(styles.title, tone === 'danger' && styles.titleDanger)}>{title}</h2>
        {meta !== undefined && <span className={styles.meta}>{meta}</span>}
        {action && <div className={styles.action}>{action}</div>}
      </header>
      {children}
    </section>
  );
}
