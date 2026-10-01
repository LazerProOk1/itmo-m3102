import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Кнопка под текстом, например «Add material» */
  action?: ReactNode;
  /** Без рамки и с меньшими отступами — для пустого списка внутри секции */
  compact?: boolean;
}

/** Заглушка для пустого списка или раздела. */
export function EmptyState({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={cn(styles.empty, compact && styles.compact)}>
      {Icon && (
        <span className={styles.icon}>
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
