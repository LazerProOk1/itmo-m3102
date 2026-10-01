import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SPRING_SMOOTH, usePrefersReducedMotion } from '../../lib/motion';

/** Мягкое появление снизу с задержкой по порядку — для каскада панелей и карточек */
export function Reveal({ index = 0, children, className }: { index?: number; children: ReactNode; className?: string }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { ...SPRING_SMOOTH, delay: Math.min(index, 10) * 0.06 } }}
    >
      {children}
    </motion.div>
  );
}
