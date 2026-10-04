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
  running?: boolean;
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

/** Высота рисунка к ширине (viewBox 170×156) */
export const HEDGEHOG_RATIO = 156 / 170;

/**
 * Сам рисунок — отдельно, чтобы использовать и в бегущем ёжике. Круглый ёжик с мордочкой вполоборота: иголки,
 * ушки, два глаза, нос, две лапки. Тело дышит, глаза моргают; running — лапки поочерёдно качаются, тело мягко
 * подпрыгивает (полшага — один подскок). facing="left" — разворот через «поворот» (scaleX через 0), а не скачком.
 */
export function HedgehogSvg({
  size = 96,
  running = false,
  facing = 'right',
  season = seasonOf(toISODate(new Date())),
}: {
  size?: number;
  running?: boolean;
  facing?: 'left' | 'right';
  /** Сезонная деталь; по умолчанию — по сегодняшней дате (обычно её нет) */
  season?: Season | null;
}) {
  return (
    <svg
      className={cn(styles.svg, running && styles.running, facing === 'left' && styles.left)}
      width={size}
      height={size * HEDGEHOG_RATIO}
      viewBox="18 4 170 156"
      aria-hidden
    >
      <ellipse className={styles.shadow} cx="109" cy="150" rx="63" ry="9" />
      {season === 'halloween' && (
        <g>
          <ellipse className={styles.pumpkin} cx="36" cy="140" rx="15" ry="12" />
          <path className={styles.pumpkinRibs} d="M36 128 C29 132 29 147 36 152 M36 128 C43 132 43 147 36 152" />
          <path className={styles.stem} d="M36 129 C36 123 38.5 121 42 120" />
        </g>
      )}
      <g className={styles.hog}>
        <g className={cn(styles.leg, styles.legBack)}>
          <path className={styles.legTop} d="M67 123 C62 130 60 139 64 146 C67 151 76 151 80 146 C82 142 79 136 76 131 Z" />
          <ellipse className={styles.paw} cx="70" cy="145" rx="9" ry="5" />
        </g>
        <g className={styles.body}>
          <path
            className={styles.spikes}
            d="M46 105 C34 99 29 89 36 82 L25 77 C36 73 41 68 40 61 L29 56 C42 53 49 49 51 42 L42 35 C56 35 64 33 69 26 L64 17 C78 21 87 20 94 14 L94 25 C105 20 114 20 124 15 L122 28 C134 24 144 27 151 31 L145 41 C158 41 168 46 174 52 L163 58 C173 64 180 72 182 80 L168 83 C177 91 179 101 177 108 L162 107 C164 119 158 128 149 132 L143 121 C133 129 119 134 105 135 C85 137 61 128 46 105 Z"
          />
          <path
            className={styles.spikesInner}
            d="M48 96 C43 86 48 73 59 65 C67 53 80 45 95 40 C113 34 132 37 147 47 C160 56 168 69 169 83 C170 101 158 116 142 124 C124 134 101 133 82 125 C66 118 55 108 48 96 Z"
          />
          <path className={styles.spikeGlint} d="M54 58L48 50L62 52Z M75 39L71 29L83 34Z M103 34L103 24L113 31Z M137 44L141 34L147 47Z" />
          <path
            className={styles.face}
            d="M83 72 C83 55 94 43 110 40 C127 37 143 45 151 58 C157 68 159 82 155 94 C151 108 139 117 124 120 C108 123 91 117 82 105 C76 96 77 83 83 72 Z"
          />
          <ellipse className={styles.cheek} cx="102" cy="94" rx="9" ry="5" />
          <g className={styles.ear}>
            <circle className={styles.face} cx="91" cy="57" r="13" />
            <circle className={styles.earInner} cx="91" cy="57" r="7" />
          </g>
          <g className={styles.ear}>
            <circle className={styles.face} cx="136" cy="55" r="13" />
            <circle className={styles.earInner} cx="136" cy="55" r="7" />
          </g>
          <g className={styles.eye}>
            <ellipse className={styles.dark} cx="105" cy="73" rx="5.5" ry="7.5" />
            <circle className={styles.glint} cx="107" cy="70" r="1.8" />
          </g>
          <g className={styles.eye}>
            <ellipse className={styles.dark} cx="132" cy="72" rx="5.5" ry="7.5" />
            <circle className={styles.glint} cx="134" cy="69" r="1.8" />
          </g>
          <path
            className={styles.muzzle}
            d="M113 77 C121 73 132 76 137 83 C142 91 139 101 132 106 C124 112 111 109 106 102 C101 94 104 82 113 77 Z"
          />
          <ellipse className={styles.dark} cx="137" cy="87" rx="7" ry="5.5" />
          <ellipse className={styles.noseGlint} cx="139" cy="85" rx="2" ry="1.5" />
          <path className={styles.smile} d="M126 94 C127 99 132 101 136 98" />
          {season === 'newyear' && (
            <g>
              <path className={styles.hat} d="M86 46 C92 24 128 8 162 8 C146 18 140 30 140 44 Z" />
              <rect className={styles.fur} x="82" y="38" width="62" height="12" rx="6" transform="rotate(-4 113 44)" />
              <circle className={styles.fur} cx="163" cy="9" r="7" />
            </g>
          )}
          {season === 'knowledge' && (
            <g>
              <path className={styles.cap} d="M95 32 L95 44 Q113 51 131 44 L131 32 Z" />
              <path className={styles.cap} d="M79 31 L113 17 L147 31 L113 45 Z" />
              <path className={styles.tassel} d="M113 31 L142 36 L142 52" />
              <circle className={styles.tasselEnd} cx="142" cy="54" r="3.5" />
            </g>
          )}
        </g>
        <g className={cn(styles.leg, styles.legFront)}>
          <path
            className={styles.legTop}
            d="M129 116 C125 126 124 138 129 145 C133 150 142 149 145 144 C148 139 145 132 142 126 C139 121 136 118 129 116 Z"
          />
          <ellipse className={styles.paw} cx="136" cy="145" rx="9" ry="5" />
        </g>
      </g>
    </svg>
  );
}
