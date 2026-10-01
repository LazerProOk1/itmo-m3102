import { motion, useAnimationControls } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { usePrefersReducedMotion } from '../../lib/motion';
import styles from './Hedgehog.module.css';

const PHRASES = ['Фыр!', 'Сальто!', 'Почитай конспекты.', 'Тестик на пять минут?', 'Мяу.', 'Несложно заметить…', 'Доо, доо.'];

interface HedgehogProps {
  size?: number;
  className?: string;
  /** Без реакции на клик — просто дышит и моргает */
  still?: boolean;
}

/** Ёжик М3102 в профиль. Дышит, моргает, топорщит иголки при наведении, по клику — сальто и реплика. */
export function Hedgehog({ size = 96, className, still = false }: HedgehogProps) {
  const controls = useAnimationControls();
  const reduceMotion = usePrefersReducedMotion();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);

  async function flip() {
    if (still || busy) return;
    setBusy(true);
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
    setBusy(false);
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
        animate={controls}
        onClick={flip}
        disabled={still}
        aria-label={still ? undefined : 'Ёжик — нажмите, он сделает сальто'}
        aria-hidden={still || undefined}
        tabIndex={still ? -1 : undefined}
      >
        <HedgehogSvg size={size} />
      </motion.button>
    </div>
  );
}

/** Сам рисунок — отдельно, чтобы использовать и в бегущем ёжике */
export function HedgehogSvg({ size = 96, running = false }: { size?: number; running?: boolean }) {
  return (
    <svg className={cn(styles.svg, running && styles.running)} width={size} height={size * 0.72} viewBox="0 0 120 86" aria-hidden>
      <ellipse className={styles.shadow} cx="60" cy="81" rx="40" ry="4" />
      <g className={styles.body}>
        {/* иголки: зубчатый купол */}
        <path
          className={styles.spikes}
          d="M14 64 L9 52 L19 50 L13 38 L25 38 L22 25 L34 29 L35 15 L46 22 L51 9 L59 19 L67 7 L72 20 L82 11 L84 25 L95 20 L94 34 L104 34 L99 46 L106 52 L96 58 L92 70 Z"
        />
        <path className={styles.spikeLines} d="M30 44 L36 36 M44 38 L50 28 M58 36 L63 24 M72 38 L78 28 M84 44 L90 36" />
        {/* мордочка */}
        <path className={styles.face} d="M86 44 C98 42 108 50 113 58 C115 61 113 64 109 64 L92 70 C86 66 82 56 86 44 Z" />
        <path className={styles.belly} d="M22 64 C34 74 76 76 94 68 L90 72 C72 80 36 79 22 64 Z" />
        <circle className={styles.nose} cx="112" cy="60" r="3.2" />
        <g className={styles.eye}>
          <circle cx="98" cy="52" r="2.6" />
          <circle className={styles.glint} cx="98.9" cy="51.1" r="0.8" />
        </g>
        <ellipse className={styles.cheek} cx="101" cy="60" rx="3.2" ry="2" />
        <circle className={styles.ear} cx="88" cy="44" r="3.4" />
        {/* лапки */}
        <g className={styles.legs}>
          <ellipse className={cn(styles.leg, styles.legFront)} cx="84" cy="77" rx="5" ry="3.2" />
          <ellipse className={cn(styles.leg, styles.legBack)} cx="34" cy="77" rx="5" ry="3.2" />
        </g>
      </g>
    </svg>
  );
}
