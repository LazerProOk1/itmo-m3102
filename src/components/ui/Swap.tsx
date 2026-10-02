import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../../lib/motion';

// Без filter: blur — на широкой сетке (неделя расписания) он дорогой и давал рывки; без пружины — без перехлёста
const variants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 24 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
  exit: (direction: number) => ({ opacity: 0, x: direction * -20, transition: { duration: 0.12, ease: [0.7, 0, 0.84, 0] } }),
};

/** Направление смены по порядковому номеру: вперёд по списку — 1, назад — −1 */
export function useDirection(order: number): number {
  const previous = useRef(order);
  const direction = useRef(0);
  if (order !== previous.current) {
    direction.current = order > previous.current ? 1 : -1;
    previous.current = order;
  }
  return direction.current;
}

/**
 * Смена содержимого с «перелистыванием»: при новом `id` старое уезжает, новое приезжает с той стороны,
 * куда идёт пользователь (direction: 1 — вперёд/вправо, −1 — назад/влево).
 */
export function Swap({ id, direction = 0, children, className }: { id: string | number; direction?: number; children: ReactNode; className?: string }) {
  const reduceMotion = usePrefersReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div key={id} className={className} custom={direction} variants={variants} initial="enter" animate="center" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
