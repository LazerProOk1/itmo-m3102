import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader2, Pause, Play, Radio, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import { storageKey } from '../../lib/storage';
import { STATIONS } from './stations';
import styles from './RadioCapsule.module.css';

const PREFS_KEY = storageKey('radio');

type Status = 'idle' | 'loading' | 'playing' | 'error';

function loadPrefs(): { station: string; volume: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as { station?: string; volume?: number } | null;
    return { station: raw?.station ?? STATIONS[0]!.id, volume: typeof raw?.volume === 'number' ? raw.volume : 0.6 };
  } catch {
    return { station: STATIONS[0]!.id, volume: 0.6 };
  }
}

/**
 * Капсула-радио в углу: лоу-фай и чилаут для учёбы. Свёрнута — кнопка и название станции, по клику
 * раскрывается: станции, переключение, громкость. Сама не играет — только по нажатию (автоплей мешает).
 * Звук живёт в AppShell, поэтому не прерывается при переходах между страницами.
 */
export function RadioCapsule() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, STATIONS.findIndex((item) => item.id === prefs.station));
  const station = STATIONS[index]!;

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // без хранилища просто не запомним станцию
    }
    if (audioRef.current) audioRef.current.volume = prefs.volume;
  }, [prefs]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // Закрыть панель кликом мимо или Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => !rootRef.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', onDown);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('pointerdown', onDown);
      removeEventListener('keydown', onKey);
    };
  }, [open]);

  function audio(): HTMLAudioElement {
    if (!audioRef.current) {
      const element = new Audio();
      element.preload = 'none';
      element.volume = prefs.volume;
      element.addEventListener('playing', () => setStatus('playing'));
      element.addEventListener('waiting', () => setStatus('loading'));
      element.addEventListener('error', () => element.src && setStatus('error'));
      audioRef.current = element;
    }
    return audioRef.current;
  }

  function play(url: string) {
    const element = audio();
    // Поток «живой»: при каждом включении — заново, а не с места паузы минуту назад
    element.src = url;
    setStatus('loading');
    void element.play().catch(() => setStatus('error'));
  }

  function stop() {
    const element = audioRef.current;
    if (!element) return;
    element.pause();
    element.removeAttribute('src');
    element.load();
    setStatus('idle');
  }

  function toggle() {
    if (status === 'playing' || status === 'loading') stop();
    else play(station.url);
  }

  function choose(nextIndex: number) {
    const next = STATIONS[(nextIndex + STATIONS.length) % STATIONS.length]!;
    setPrefs((current) => ({ ...current, station: next.id }));
    if (status !== 'idle') play(next.url);
  }

  useEffect(() => () => audioRef.current?.pause(), []);

  const active = status === 'playing' || status === 'loading';

  return (
    <div ref={rootRef} className={styles.root}>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={SPRING_SNAPPY}
            role="dialog"
            aria-label="Радио"
          >
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>
                <Radio size={14} strokeWidth={2} aria-hidden /> Радио для учёбы
              </span>
              <button type="button" className={styles.iconButton} onClick={() => setOpen(false)} aria-label="Свернуть">
                <ChevronDown size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <ul className={styles.stations}>
              {STATIONS.map((item, itemIndex) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(styles.station, item.id === station.id && styles.current)}
                    onClick={() => (item.id === station.id ? toggle() : choose(itemIndex))}
                  >
                    <span className={styles.stationName}>
                      {item.name}
                      {item.id === station.id && active && <Bars playing={status === 'playing'} />}
                    </span>
                    <span className={styles.stationDescription}>{item.description}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className={styles.controls}>
              <button type="button" className={styles.iconButton} onClick={() => choose(index - 1)} aria-label="Предыдущая станция">
                <SkipBack size={16} strokeWidth={2} aria-hidden />
              </button>
              <button type="button" className={styles.playBig} onClick={toggle} aria-label={active ? 'Пауза' : 'Играть'}>
                <PlayIcon status={status} size={18} />
              </button>
              <button type="button" className={styles.iconButton} onClick={() => choose(index + 1)} aria-label="Следующая станция">
                <SkipForward size={16} strokeWidth={2} aria-hidden />
              </button>
              <button type="button" className={styles.iconButton} onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
                {muted || prefs.volume === 0 ? <VolumeX size={16} strokeWidth={2} aria-hidden /> : <Volume2 size={16} strokeWidth={2} aria-hidden />}
              </button>
              <input
                className={styles.volume}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={prefs.volume}
                onChange={(event) => {
                  setMuted(false);
                  setPrefs((current) => ({ ...current, volume: Number(event.target.value) }));
                }}
                aria-label="Громкость"
                style={{ '--fill': `${prefs.volume * 100}%` } as React.CSSProperties}
              />
            </div>

            <p className={styles.credit}>
              {status === 'error' ? 'Станция не отвечает — попробуйте другую. ' : ''}
              Поток:{' '}
              <a href={station.source.href} target="_blank" rel="noopener noreferrer">
                {station.source.name}
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className={cn(styles.capsule, active && styles.on)} layout transition={SPRING_SNAPPY}>
        <button type="button" className={styles.play} onClick={toggle} aria-label={active ? 'Пауза' : `Включить радио «${station.name}»`}>
          <PlayIcon status={status} size={15} />
        </button>
        <button type="button" className={styles.label} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Радио: станции и громкость">
          {active ? <Bars playing={status === 'playing'} /> : <Radio size={14} strokeWidth={2} aria-hidden />}
          <span>{status === 'error' ? 'Нет связи' : station.name}</span>
        </button>
      </motion.div>
    </div>
  );
}

function PlayIcon({ status, size }: { status: Status; size: number }) {
  if (status === 'loading') return <Loader2 size={size} strokeWidth={2.2} className={styles.spin} aria-hidden />;
  if (status === 'playing') return <Pause size={size} strokeWidth={2.2} aria-hidden />;
  return <Play size={size} strokeWidth={2.2} aria-hidden />;
}

/** Эквалайзер: три столбика, «танцуют», пока идёт звук */
function Bars({ playing }: { playing: boolean }) {
  return (
    <span className={cn(styles.bars, playing && styles.barsOn)} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}
