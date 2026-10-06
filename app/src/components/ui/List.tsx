import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties, PointerEventHandler, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import { useCursorGlow } from '../../lib/useCursorGlow';
import styles from './List.module.css';

interface ListProps {
  children: ReactNode;
  className?: string;
}

/**
 * Список строк с тонкими разделителями. Внутри — компоненты ListItem.
 * Удаление строки (или уход задачи из отфильтрованного списка) плавно схлопывает
 * список вместо мгновенной дыры на её месте — см. ListItem.
 */
export function List({ children, className }: ListProps) {
  return (
    <ul className={cn(styles.list, className)}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  );
}

interface ListItemProps {
  title: ReactNode;
  /** Вторая строка мелким шрифтом */
  meta?: ReactNode;
  /** Слева: иконка, чекбокс, время */
  leading?: ReactNode;
  /** Справа: дата, бейдж, кабинет */
  trailing?: ReactNode;
  /** Приглушить строку (прошедшее занятие, выполненная задача) */
  muted?: boolean;
  /** Выделить строку (текущее занятие) */
  highlighted?: boolean;
  /** На телефоне trailing (бейджи, дата, меню) — второй строкой под заголовком, а не сжимает его до «Подгото…» */
  wrapOnPhone?: boolean;
  className?: string;
  /** Например, кастомное свойство --type-color для строки, зависящее от данных */
  style?: CSSProperties;
  /** Для курсор-aware свечения карточки (см. useCursorGlow) — не используется обычными строками */
  onPointerMove?: PointerEventHandler<HTMLLIElement>;
  onPointerLeave?: PointerEventHandler<HTMLLIElement>;
}

/** Строка списка: [leading] заголовок и мета [trailing]. Новая строка слегка "впрыгивает" пружиной. */
export function ListItem({
  title,
  meta,
  leading,
  trailing,
  muted = false,
  highlighted = false,
  wrapOnPhone = false,
  className,
  style,
  onPointerMove,
  onPointerLeave,
}: ListItemProps) {
  const glow = useCursorGlow();
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING_SNAPPY }}
      exit={{
        opacity: 0,
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        transition: { duration: 0.2, ease: [0.7, 0, 0.84, 0] },
      }}
      transition={SPRING_SNAPPY}
      className={cn(styles.item, muted && styles.muted, highlighted && styles.highlighted, wrapOnPhone && styles.wrapPhone, className)}
      style={{ overflow: 'hidden', ...style }}
      // data-lit: подсветка под курсором (aurora.css); координаты пишет useCursorGlow
      data-lit=""
      onPointerMove={onPointerMove ?? glow.onPointerMove}
      onPointerLeave={onPointerLeave ?? glow.onPointerLeave}
    >
      {leading && <div className={styles.leading}>{leading}</div>}
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {meta && <p className={styles.meta}>{meta}</p>}
      </div>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </motion.li>
  );
}
