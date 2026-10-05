import { motion, useAnimationControls } from 'framer-motion';
import { useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { toISODate } from '../../lib/dates';
import { usePrefersReducedMotion } from '../../lib/motion';
import styles from './Hedgehog.module.css';
import { seasonOf, type Season } from './season';

const PHRASES = ['Фыр!', 'Сальто!', 'Почитай конспекты.', 'Тестик на пять минут?', 'Мяу.', 'Несложно заметить…', 'Доо, доо.'];

interface HedgehogProps {
  size?: number;
  className?: string;
  /** Без реакции на клик — просто дышит и моргает */
  still?: boolean;
  /** Перебирает лапками — когда бежит (шапка главной) */
  running?: boolean | 'gallop';
  facing?: 'left' | 'right';
}

/** Ёжик М3102. Дышит, моргает, топорщит иголки при наведении, по клику — сальто и реплика. */
export function Hedgehog({ size = 96, className, still = false, running = false, facing = 'right' }: HedgehogProps) {
  const controls = useAnimationControls();
  const reduceMotion = usePrefersReducedMotion();
  const [phrase, setPhrase] = useState('');
  const busy = useRef(false);

  async function flip() {
    if (still || busy.current) return;
    busy.current = true;
    setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]!);
    if (!reduceMotion) {
      await controls.start({
        y: [0, -size * 0.45, 0, -size * 0.06, 0],
        rotate: [0, -200, -360, -360, -360],
        scaleY: [1, 0.92, 1, 0.94, 1],
        transition: { duration: 0.9, times: [0, 0.35, 0.7, 0.85, 1], ease: 'easeOut' },
      });
      controls.set({ rotate: 0 });
    }
    setTimeout(() => setPhrase(''), 1600);
    busy.current = false;
  }

  return (
    <div className={cn(styles.wrap, className)} style={{ width: size }}>
      {phrase && (
        <motion.span
          key={phrase}
          className={styles.bubble}
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          {phrase}
        </motion.span>
      )}
      <motion.button
        type="button"
        className={styles.button}
        data-no-ripple
        animate={controls}
        onClick={flip}
        disabled={still}
        aria-label={still ? undefined : 'Ёжик — нажмите, он сделает сальто'}
        aria-hidden={still || undefined}
        tabIndex={still ? -1 : undefined}
      >
        <HedgehogSvg size={size} running={running} facing={facing} />
      </motion.button>
    </div>
  );
}

/** Высота рисунка к ширине (viewBox 120×86) */
export const HEDGEHOG_RATIO = 86 / 120;

/**
 * Сам рисунок — отдельно, чтобы использовать и в бегущем ёжике. Как эмодзи 🦔: сплошное тело под иголками
 * (раньше между иголками и животиком был просвет — «дырка в животе»), светлые мордочка и животик, четыре лапки.
 * Дышит и моргает; running — лапки плавно ходят поочерёдно, тело мягко подпрыгивает на каждый шаг.
 * facing="left" — разворот через «поворот» (scaleX через 0), а не скачком.
 */
export function HedgehogSvg({
  size = 96,
  running = false,
  facing = 'right',
  season = seasonOf(toISODate(new Date())),
}: {
  size?: number;
  running?: boolean | 'gallop';
  facing?: 'left' | 'right';
  /** Сезонная деталь; по умолчанию — по сегодняшней дате (обычно её нет) */
  season?: Season | null;
}) {
  return (
    <svg
      className={cn(styles.svg, running && styles.running, running === 'gallop' && styles.gallop, facing === 'left' && styles.left)}
      width={size}
      height={size * HEDGEHOG_RATIO}
      viewBox="0 0 120 86"
      aria-hidden
    >
      <ellipse className={styles.shadow} cx="60" cy="81" rx="42" ry="4" />
      {season === 'halloween' && (
        <g>
          <ellipse className={styles.pumpkin} cx="10" cy="74" rx="9" ry="7.5" />
          <path className={styles.pumpkinRibs} d="M10 67 C6 70 6 78 10 81.5 M10 67 C14 70 14 78 10 81.5" />
          <path className={styles.stem} d="M10 67.5 C10 64 11.5 62.5 13.5 62" />
        </g>
      )}
      <g className={styles.hog}>
        {/* дальние лапки — за телом */}
        <ellipse className={cn(styles.leg, styles.legBack)} cx="44" cy="76" rx="5.5" ry="3.6" />
        <ellipse className={cn(styles.leg, styles.legFront)} cx="88" cy="76" rx="5.5" ry="3.6" />
        <g className={styles.body}>
          {/* тело — сплошное, под иголками */}
          <path className={styles.spikes} d="M12 62 C10 44 30 26 58 25 C84 24 102 38 104 56 C105 68 92 75 60 75 C30 75 13 72 12 62 Z" />
          {/* иголки: зубчатый край по спине */}
          <path
            className={styles.spikes}
            d="M12 60 L5 52 L14 47 L7 37 L19 35 L15 23 L28 25 L28 12 L40 18 L44 5 L54 14 L61 3 L68 14 L78 6 L81 19 L92 14 L92 28 L102 27 L98 38 L104 44 L96 48 Z"
          />
          <path className={styles.spikeLines} d="M24 46 L30 38 M36 40 L42 30 M50 36 L55 26 M64 36 L69 26 M78 40 L84 31" />
          {/* животик */}
          <ellipse className={styles.belly} cx="58" cy="69" rx="32" ry="7" />
          {/* мордочка с носиком */}
          <path className={styles.face} d="M84 42 C96 39 109 47 115 57 C117 61 115 65 110 66 C100 70 90 70 84 64 C79 58 79 47 84 42 Z" />
          <circle className={styles.ear} cx="86" cy="42" r="4" />
          <circle className={styles.nose} cx="114" cy="59" r="3.6" />
          <g className={styles.eye}>
            <circle className={styles.dark} cx="99" cy="51" r="3.6" />
            <circle className={styles.glint} cx="100.3" cy="49.8" r="1.2" />
          </g>
          <ellipse className={styles.cheek} cx="103" cy="60" rx="3.6" ry="2.2" />
          <path className={styles.smile} d="M105 63 Q108 65 111 63" />
          {season === 'newyear' && (
            <g>
              <path className={styles.hat} d="M84 41 C88 30 100 22 113 19 C107 26 105 34 105 42 Z" />
              <rect className={styles.fur} x="81" y="37" width="26" height="6.5" rx="3.25" transform="rotate(6 94 40)" />
              <circle className={styles.fur} cx="113" cy="19" r="3.6" />
            </g>
          )}
          {season === 'knowledge' && (
            <g>
              <path className={styles.cap} d="M88 34 L88 40 Q96 43.5 104 40 L104 34 Z" />
              <path className={styles.cap} d="M80 33 L96 27 L112 33 L96 39 Z" />
              <path className={styles.tassel} d="M96 33 L109 35 L109 42" />
              <circle className={styles.tasselEnd} cx="109" cy="43" r="1.8" />
            </g>
          )}
        </g>
        {/* ближние лапки — перед телом */}
        <ellipse className={cn(styles.leg, styles.legFront)} cx="34" cy="78" rx="6" ry="3.8" />
        <ellipse className={cn(styles.leg, styles.legBack)} cx="78" cy="78" rx="6" ry="3.8" />
      </g>
    </svg>
  );
}
