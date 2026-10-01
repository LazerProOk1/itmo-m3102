import { motion } from 'framer-motion';
import { useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/motion';
import { HedgehogSvg } from './Hedgehog';
import styles from './RunawayHedgehog.module.css';

/** «Ёжик вырвался на свободу.» — один раз пробегает по низу экрана и исчезает */
export function RunawayHedgehog() {
  const reduceMotion = usePrefersReducedMotion();
  const [done, setDone] = useState(false);
  if (reduceMotion || done) return null;

  return (
    <motion.div
      className={styles.runner}
      initial={{ x: '-120px' }}
      animate={{ x: 'calc(100vw + 40px)' }}
      transition={{ duration: 4.2, ease: 'linear', delay: 0.6 }}
      onAnimationComplete={() => setDone(true)}
      aria-hidden
    >
      <HedgehogSvg size={64} running />
    </motion.div>
  );
}
