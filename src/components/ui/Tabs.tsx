import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import styles from './Tabs.module.css';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** Число справа от названия, например количество задач */
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Название группы вкладок для скринридера */
  label: string;
  className?: string;
}

/** Вкладки с тонким подчёркиванием активной. Содержимое вкладок рисует сама страница. */
export function Tabs<T extends string>({ items, value, onChange, label, className }: TabsProps<T>) {
  const indicatorId = useId();

  return (
    <div role="tablist" aria-label={label} className={cn(styles.list, className)}>
      {items.map((item) => {
        const isActive = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(styles.tab, isActive && styles.active)}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
            {/* Один и тот же layoutId переезжает между вкладками — отсюда «проезд» подчёркивания */}
            {isActive && (
              <motion.span
                layoutId={`tabs-indicator-${indicatorId}`}
                className={styles.indicator}
                transition={SPRING_SNAPPY}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
