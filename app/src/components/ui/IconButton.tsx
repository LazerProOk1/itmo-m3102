import type { LucideIcon } from 'lucide-react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: LucideIcon;
  /** Обязательно: читается скринридером и показывается как подсказка при наведении */
  label: string;
  size?: 'sm' | 'md';
}

/** Квадратная кнопка только с иконкой — тактильное сжатие под пальцем (Framer Motion spring). */
export function IconButton({ icon: Icon, label, size = 'md', type = 'button', className, disabled, ...rest }: IconButtonProps) {
  return (
    <motion.button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(styles.button, styles[size], className)}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      transition={SPRING_SNAPPY}
      {...rest}
    >
      <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.75} aria-hidden />
    </motion.button>
  );
}
