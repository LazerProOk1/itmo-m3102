import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/motion';
import { Hedgehog } from './Hedgehog';
import styles from './HedgehogLane.module.css';
import { backflip, HOG, HOP, hopsFor, runHops, wait } from './moves';

/** Через сколько без мыши, клавиатуры и прокрутки ёжик засыпает */
const IDLE_MS = 60_000;

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
  const [asleep, setAsleep] = useState(false);
  /** Пора спать — ляжет, добежав до края; wakeUp — разбудить */
  const sleepy = useRef(false);
  const wakeUp = useRef<(() => void) | null>(null);
  const wake = () => {
    sleepy.current = false;
    wakeUp.current?.();
  };

  // Минуту ничего не трогают — засыпает. Движение мыши только откладывает сон (можно подвести курсор и нажать
  // на спящего — «Я не спал»), будят клик, клавиша и прокрутка
  useEffect(() => {
    if (reduceMotion) return undefined;
    let timer = 0;
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (sleepy.current = true), IDLE_MS);
    };
    const rouse = (event: Event) => {
      later();
      if (event.target instanceof Element && event.target.closest('[data-hog]')) return;
      if (sleepy.current) wake();
    };
    later();
    const rousing = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const;
    addEventListener('pointermove', later, { passive: true });
    for (const name of rousing) addEventListener(name, rouse, { passive: true, capture: true });
    return () => {
      window.clearTimeout(timer);
      removeEventListener('pointermove', later);
      for (const name of rousing) removeEventListener(name, rouse, { capture: true });
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    let alive = true;
    void (async () => {
      let direction = 1;
      let x = 0;
      await wait(1000);
      while (alive) {
        const target = direction === 1 ? Math.max(0, (lane.current?.clientWidth ?? 0) - HOG) : 0;
        const hops = hopsFor(Math.abs(target - x));
        setRunning(true);
        void runHops(jump, hops, direction);
        await travel.start({ x: target, transition: { duration: hops * HOP, ease: 'linear' } });
        x = target;
        setRunning(false);
        if (!alive) break;
        const turned = direction === 1 ? 'left' : 'right';
        await backflip(jump, direction, () => setFacing(turned));
        direction = -direction;
        await wait(200);
        if (sleepy.current && alive) {
          // Улёгся: чуть приплюснут к земле, глаза закрыты, «z» — до первого клика, клавиши или прокрутки
          setAsleep(true);
          await jump.start({ y: 2, scaleX: 1.05, scaleY: 0.9, transition: { duration: 0.5, ease: 'easeInOut' } });
          await new Promise<void>((resolve) => (wakeUp.current = resolve));
          wakeUp.current = null;
          setAsleep(false);
          if (!alive) break;
          // Проснулся — потянулся и побежал дальше
          await jump.start({ y: [2, -6, 0], scaleX: [1.05, 0.94, 1], scaleY: [0.9, 1.1, 1], transition: { duration: 0.5, ease: 'easeOut' } });
        }
      }
    })();
    return () => {
      alive = false;
      wakeUp.current?.();
      travel.stop();
      jump.stop();
    };
  }, [reduceMotion, travel, jump]);

  return (
    <div ref={lane} className={styles.lane}>
      <motion.div className={styles.runner} animate={travel}>
        <motion.div className={styles.jumper} animate={jump}>
          <Hedgehog size={HOG} running={running} facing={facing} sleeping={asleep} onWake={wake} />
        </motion.div>
      </motion.div>
    </div>
  );
}
