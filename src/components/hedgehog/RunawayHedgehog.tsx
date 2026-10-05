import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePrefersReducedMotion } from '../../lib/motion';
import { Hedgehog, HEDGEHOG_RATIO } from './Hedgehog';
import { backflip, HOG, HOP, hopsFor, runHops, wait } from './moves';
import styles from './RunawayHedgehog.module.css';

/** Следующая точка — случайная, но не ближе трети экрана: короткие перебежки выглядят как дёрганье */
function nextPoint(from: { x: number; y: number }, width: number, height: number) {
  const maxX = Math.max(0, width - HOG);
  const maxY = Math.max(0, height - HOG * HEDGEHOG_RATIO);
  for (let attempt = 0; ; attempt++) {
    const point = { x: Math.random() * maxX, y: Math.random() * maxY };
    if (attempt > 8 || Math.hypot(point.x - from.x, point.y - from.y) > Math.min(width, height) / 3) return point;
  }
}

/**
 * «Ёжик вырвался на свободу.» — бегает скачками по всему экрану, пока открыта главная: от точки к точке,
 * то принюхивается, то делает сальто с разворотом. По клику — своё сальто с репликой, как на дорожке.
 * Слой не перехватывает нажатия — только сам ёжик. «Уменьшить движение» — не появляется.
 */
export function RunawayHedgehog() {
  const reduceMotion = usePrefersReducedMotion();
  const area = useRef<HTMLDivElement>(null);
  const travel = useAnimationControls();
  const jump = useAnimationControls();
  const [running, setRunning] = useState(false);
  const [facing, setFacing] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (reduceMotion) return undefined;
    let alive = true;
    void (async () => {
      // Выбегает из-за левого края у низа экрана
      let at = { x: -HOG, y: (area.current?.clientHeight ?? 0) - HOG };
      travel.set(at);
      await wait(600);
      while (alive && area.current) {
        const to = nextPoint(at, area.current.clientWidth, area.current.clientHeight);
        const direction = to.x >= at.x ? 1 : -1;
        setFacing(direction === 1 ? 'right' : 'left');
        const hops = hopsFor(Math.hypot(to.x - at.x, to.y - at.y));
        setRunning(true);
        void runHops(jump, hops, direction);
        await travel.start({ ...to, transition: { duration: hops * HOP, ease: 'linear' } });
        at = to;
        setRunning(false);
        if (!alive) break;
        // Через раз — сальто, иначе передышка
        if (Math.random() < 0.5) await backflip(jump, direction);
        await wait(300 + Math.random() * 900);
      }
    })();
    return () => {
      alive = false;
      travel.stop();
      jump.stop();
    };
  }, [reduceMotion, travel, jump]);

  if (reduceMotion) return null;
  // В body: у страниц на время перехода есть transform, и fixed внутри них считался бы от страницы, а не от экрана
  return createPortal(
    <div ref={area} className={styles.area}>
      <motion.div className={styles.runner} animate={travel}>
        <motion.div className={styles.jumper} animate={jump}>
          <Hedgehog size={HOG} running={running} facing={facing} />
        </motion.div>
      </motion.div>
    </div>,
    document.body,
  );
}
