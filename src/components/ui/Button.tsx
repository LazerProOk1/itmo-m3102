import type { LucideIcon } from 'lucide-react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** primary — главное действие на экране, secondary — обычное, ghost — самое тихое */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Иконка Lucide слева от текста */
  icon?: LucideIcon;
  children?: ReactNode;
}

/** Только эти варианты физически «приподнимаются» на hover — ghost/danger остаются плоскими */
const LIFTS_ON_HOVER = new Set<ButtonVariant>(['primary', 'secondary']);

/**
 * Классы кнопки отдельно — чтобы оформить как кнопку обычную ссылку:
 * <Link to="/tasks" className={buttonClass('ghost', 'sm')}>All tasks</Link>
 */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cn(styles.button, styles[variant], styles[size]);
}

/**
 * Кнопка с настоящей пружинной физикой нажатия (Framer Motion whileHover/whileTap),
 * а не CSS-transition — приподнимается на hover, мгновенно «проседает» под пальцем.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 14 : 16;
  const lifts = LIFTS_ON_HOVER.has(variant);

  return (
    <motion.button
      type={type}
      className={cn(buttonClass(variant, size), className)}
      disabled={disabled}
      whileHover={disabled ? undefined : lifts ? { y: -2 } : undefined}
      whileTap={disabled ? undefined : { y: 0, scale: 0.97 }}
      transition={SPRING_SNAPPY}
      {...rest}
    >
      {Icon && <Icon size={iconSize} strokeWidth={2} aria-hidden />}
      {children}
    </motion.button>
  );
}
