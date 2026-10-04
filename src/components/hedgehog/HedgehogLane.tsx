import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/motion';
import { Hedgehog } from './Hedgehog';
import styles from './HedgehogLane.module.css';

/** Ширина ёжика на дорожке — та же, что --hog в HedgehogLane.module.css */
const HOG = 60;
/** Скорость бега, px/с: на ПК дорожка ~1000px — проход за ~8 с */
const SPEED = 125;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ёжик бегает по дорожке туда-обратно, как на сайте группы. Сценарий, а не CSS-цикл, — так движения плавные:
 * разгон и торможение по настоящей ширине дорожки, у края — присел, сальто, мягкое приземление, разворот.
 * По клику — своё сальто с репликой. «Уменьшить движение» — стоит в начале дорожки.
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
      await wait(1200);
      while (alive) {
        const width = lane.current?.clientWidth ?? 0;
        setRunning(true);
        await travel.start({
          x: direction === 1 ? Math.max(0, width - HOG) : 0,
          transition: { duration: Math.max(1.5, width / SPEED), ease: [0.45, 0, 0.55, 1] },
        });
        setRunning(false);
        if (!alive) break;
        await wait(300);
        // Присел — сальто назад — приземлился с пружинкой
        await jump.start({ scaleX: 1.08, scaleY: 0.86, transition: { duration: 0.16, ease: 'easeOut' } });
        await jump.start({
          y: [0, -HOG * 0.75, 0],
          rotate: [0, -360 * direction],
          scaleX: 1,
          scaleY: 1,
          transition: {
            y: { duration: 0.7, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] },
            rotate: { duration: 0.7, ease: [0.4, 0, 0.3, 1] },
            scaleX: { duration: 0.2 },
            scaleY: { duration: 0.2 },
          },
        });
        jump.set({ rotate: 0 });
        await jump.start({ scaleX: [1.1, 1], scaleY: [0.85, 1], transition: { type: 'spring', stiffness: 420, damping: 14 } });
        if (!alive) break;
        await wait(450);
        direction = -direction;
        setFacing(direction === 1 ? 'right' : 'left');
        await wait(650);
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
