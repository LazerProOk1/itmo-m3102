import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/motion';
import { Hedgehog } from './Hedgehog';
import styles from './HedgehogLane.module.css';
import { backflip, gallop, HOG, STRIDE, stridesFor, wait } from './moves';

/**
 * Ёжик бегает по дорожке туда-обратно, как на сайте группы: скачет на бегу, задирая нос, а у края — присел,
 * высокий кувырок назад и разворот прямо в воздухе (приземляется уже мордой в другую сторону), пружинка — и обратно.
 * Сценарий, а не CSS-цикл: число скачков подогнано под настоящую ширину дорожки, поэтому бег и прыжки заканчиваются
 * вместе, без рывков. По клику — своё сальто с репликой. «Уменьшить движение» — стоит в начале дорожки.
 */
export function HedgehogLane() {
  const reduceMotion = usePrefersReducedMotion();
  const lane = useRef<HTMLDivElement>(null);
  const travel = useAnimationControls();
  const jump = useAnimationControls();
  const [running, setRunning] = useState(false);
  const [facing, setFacing] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (reduceMotion) return undefined;
    let alive = true;
    void (async () => {
      let direction = 1;
      let x = 0;
      await wait(1000);
      while (alive) {
        const target = direction === 1 ? Math.max(0, (lane.current?.clientWidth ?? 0) - HOG) : 0;
        const strides = stridesFor(Math.abs(target - x));
        setRunning(true);
        void gallop(jump, strides, direction);
        await travel.start({ x: target, transition: { duration: strides * STRIDE, ease: 'linear' } });
        x = target;
        setRunning(false);
        if (!alive) break;
        const turned = direction === 1 ? 'left' : 'right';
        await backflip(jump, direction, () => setFacing(turned));
        direction = -direction;
        await wait(200);
      }
    })();
    return () => {
      alive = false;
      travel.stop();
      jump.stop();
    };
  }, [reduceMotion, travel, jump]);

  return (
    <div ref={lane} className={styles.lane}>
      <motion.div className={styles.runner} animate={travel}>
        <motion.div className={styles.jumper} animate={jump}>
          <Hedgehog size={HOG} running={running} facing={facing} />
        </motion.div>
      </motion.div>
    </div>
  );
}
