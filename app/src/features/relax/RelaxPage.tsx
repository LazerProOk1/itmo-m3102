import { Maximize2, Minimize2, Pause, Play, Shuffle, Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { usePrefersReducedMotion } from '../../lib/motion';
import { accentColor, randomPair } from '../settings/appearance';
import { useSettingsStore } from '../settings/settingsStore';
import { createFlow, type Flow } from './flow';
import styles from './RelaxPage.module.css';

/** Цвета из настроек: первый акцент и второй (для «Авто» и «Нет» — запасной розовый, чтобы переливы были видны) */
function siteColors(accent: string, accent2: string): [string, string] {
  const first = accentColor(accent);
  const second = accent2 === 'auto' || accent2 === 'none' ? '#ec4899' : accentColor(accent2);
  return [first, second];
}

/**
 * «Релакс» — просто позалипать: поле течения из светящихся частиц в цветах акцентов сайта. Водить курсором или пальцем —
 * частицы закручиваются, нажать — вспышка. Ничего не считает и не сохраняет.
 */
export function RelaxPage() {
  const accent = useSettingsStore((state) => state.accent);
  const accent2 = useSettingsStore((state) => state.accent2);
  const reduceMotion = Boolean(usePrefersReducedMotion());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<Flow | null>(null);
  const [paused, setPaused] = useState(false);
  const [custom, setCustom] = useState<[string, string] | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const colors = custom ?? siteColors(accent, accent2);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const flow = createFlow(canvasRef.current, { colors, still: reduceMotion });
    flowRef.current = flow;
    return () => {
      flow.destroy();
      flowRef.current = null;
    };
    // Движок создаётся один раз на страницу; цвета меняются отдельным эффектом ниже
  }, [reduceMotion]);

  useEffect(() => {
    flowRef.current?.setColors(colors[0], colors[1]);
  }, [colors[0], colors[1]]);

  useEffect(() => {
    flowRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <>
      <PageHeader title="Релакс" subtitle="Просто посмотреть. Проведите курсором или пальцем — частицы закрутятся, нажмите — вспыхнут." />

      <div ref={stageRef} className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} aria-label="Переливающееся поле из частиц — для успокоения" role="img" />
        <div className={styles.bar}>
          {!reduceMotion && (
            <Button variant="secondary" size="sm" icon={paused ? Play : Pause} onClick={() => setPaused((value) => !value)}>
              {paused ? 'Продолжить' : 'Пауза'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={Shuffle}
            onClick={() => {
              const pair = randomPair();
              setCustom([pair.a, pair.b]);
            }}
          >
            Другие цвета
          </Button>
          {custom && (
            <Button variant="ghost" size="sm" icon={Palette} onClick={() => setCustom(null)}>
              Мои цвета
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={fullscreen ? Minimize2 : Maximize2} onClick={toggleFullscreen}>
            {fullscreen ? 'Выйти' : 'На весь экран'}
          </Button>
        </div>
      </div>
      {reduceMotion && <p className={styles.note}>В системе включено «уменьшить движение», поэтому здесь неподвижная картинка.</p>}
    </>
  );
}
