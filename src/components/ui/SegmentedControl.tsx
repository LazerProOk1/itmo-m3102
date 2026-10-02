import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '../../lib/cn';
import { onRovingKeyDown } from '../../lib/rovingKeys';
import { SPRING_SNAPPY } from '../../lib/motion';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Название группы для скринридера */
  label: string;
}

/** Выбор одного варианта из нескольких: Light / Dark / System, Day / Week / Month. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  const thumbId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={styles.root}
      onKeyDown={(event) => onRovingKeyDown(event, options.map((option) => option.value), value, onChange)}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            className={cn(styles.item, isActive && styles.active)}
            onClick={() => onChange(option.value)}
          >
            {/* Один и тот же layoutId переезжает с прошлой активной кнопки на новую — отсюда «проезд» вместо телепортации */}
            {isActive && (
              <motion.span
                layoutId={`segmented-thumb-${thumbId}`}
                className={styles.thumb}
                transition={SPRING_SNAPPY}
              />
            )}
            <span className={styles.content}>
              {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
