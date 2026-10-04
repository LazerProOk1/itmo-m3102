import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/motion';
import { Hedgehog } from './Hedgehog';
import styles from './HedgehogLane.module.css';

/** Ширина ёжика на дорожке — та же, что --hog в HedgehogLane.module.css */
const HOG = 60;
/** Скорость бега, px/с: на ПК дорожка ~1000px — проход за ~7 с */
const SPEED = 140;
/** Один скачок на бегу, с */
const HOP = 0.42;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
        const hops = Math.max(2, Math.round(Math.abs(target - x) / SPEED / HOP));
        // Бег скачками: вверх — замедляясь, вниз — ускоряясь; на подъёме нос задран
        setRunning(true);
        void jump.start({
          y: [0, -HOG * 0.28, 0],
          rotate: [0, -16 * direction, 0],
          transition: { duration: HOP, times: [0, 0.5, 1], ease: ['easeOut', 'easeIn'], repeat: hops - 1 },
        });
        await travel.start({ x: target, transition: { duration: hops * HOP, ease: 'linear' } });
        x = target;
        setRunning(false);
        if (!alive) break;
        // Присел — кувырок назад, на половине оборота развернулся — приземлился с пружинкой
        await jump.start({ y: 0, rotate: 0, scaleX: 1.12, scaleY: 0.82, transition: { duration: 0.1, ease: 'easeOut' } });
        const turn = wait(260).then(() => setFacing(direction === 1 ? 'left' : 'right'));
        await jump.start({
          y: [0, -HOG * 1.15, 0],
          rotate: [0, -360 * direction],
          scaleX: 1,
          scaleY: 1,
          transition: {
            y: { duration: 0.78, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] },
            rotate: { duration: 0.78, ease: [0.3, 0, 0.35, 1] },
            scaleX: { duration: 0.15 },
            scaleY: { duration: 0.15 },
          },
        });
        await turn;
        jump.set({ rotate: 0 });
        await jump.start({ scaleX: [1.15, 1], scaleY: [0.8, 1], transition: { type: 'spring', stiffness: 520, damping: 12 } });
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
