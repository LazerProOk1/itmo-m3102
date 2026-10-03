import { useEffect } from 'react';
import { installRipple } from '../../lib/ripple';
import { useSettingsStore } from './settingsStore';

/** Готовые акценты: насыщенные, но не «кислотные» — читаются и на светлом, и на тёмном фоне */
export const ACCENTS = [
  { id: 'indigo', name: 'Индиго', color: '#5b6cf9' },
  { id: 'violet', name: 'Фиалка', color: '#8b5cf6' },
  { id: 'sky', name: 'Небо', color: '#0ea5e9' },
  { id: 'teal', name: 'Бирюза', color: '#14b8a6' },
  { id: 'emerald', name: 'Изумруд', color: '#22c55e' },
  { id: 'amber', name: 'Янтарь', color: '#f59e0b' },
  { id: 'coral', name: 'Коралл', color: '#f43f5e' },
  { id: 'rose', name: 'Роза', color: '#ec4899' },
] as const;

/** Свой цвет из пипетки — OKLCH с постоянной яркостью: любой оттенок одинаково читается, не «кислотный» */
export const CUSTOM_LIGHTNESS = 0.66;
export const customAccent = (hue: number, chroma: number) => `oklch(${CUSTOM_LIGHTNESS} ${chroma.toFixed(3)} ${Math.round(hue)})`;

/** Оттенок и насыщенность своего цвета — чтобы пипетка открывалась на нём же */
export function parseCustomAccent(accent: string): { hue: number; chroma: number } | null {
  const match = /^oklch\(\s*[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(accent);
  return match ? { chroma: Number(match[1]), hue: Number(match[2]) } : null;
}

export const accentColor = (accent: string) =>
  ACCENTS.find((item) => item.id === accent)?.color ?? (/^#[0-9a-f]{6}$/i.test(accent) || parseCustomAccent(accent) ? accent : ACCENTS[0].color);

/**
 * Оформление на <html>: --accent-base (из него в tokens.css считаются все оттенки акцента),
 * data-aurora / data-glow / data-radius — по ним включаются слои из styles/aurora.css.
 */
export function useApplyAppearance() {
  const { accent, aurora, glow, liveBg, radius } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-base', accentColor(accent));
    root.dataset.aurora = aurora ? 'on' : 'off';
    root.dataset.glow = glow ? 'on' : 'off';
    root.dataset.radius = radius;
  }, [accent, aurora, glow, radius]);

  // Подсветка под курсором: один обработчик на всю страницу пишет координаты в ту карточку
  // [data-spot], над которой курсор, — никаких слушателей на каждой карточке
  useEffect(() => {
    if (!glow) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const update = () => {
      frame = 0;
      const card = (last?.target as Element | null)?.closest<HTMLElement>('[data-spot]');
      if (!card || !last) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${last.clientX - rect.left}px`);
      card.style.setProperty('--my', `${last.clientY - rect.top}px`);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      last = event;
      if (!frame) frame = requestAnimationFrame(update);
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => {
      removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [glow]);

  // Волна от точки клика — часть «Свечения»: выключили эффекты — кнопки снова тихие
  useEffect(() => (glow ? installRipple() : undefined), [glow]);

  // Живой фон: пятна сияния догоняют курсор и уезжают при прокрутке (параллакс). Значения плавно
  // «доезжают» до цели в цикле кадров, который сам останавливается, когда догнал, — без работы в покое
  useEffect(() => {
    const layer = document.querySelector<HTMLElement>('.aurora');
    if (!liveBg || !aurora || !layer || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const target = { x: 0, y: 0, s: 0 };
    const now = { x: 0, y: 0, s: 0 };
    let frame = 0;
    const tick = () => {
      let moving = false;
      for (const key of ['x', 'y', 's'] as const) {
        now[key] += (target[key] - now[key]) * 0.06;
        if (Math.abs(target[key] - now[key]) > 0.001) moving = true;
      }
      layer.style.setProperty('--bg-x', now.x.toFixed(3));
      layer.style.setProperty('--bg-y', now.y.toFixed(3));
      layer.style.setProperty('--bg-s', now.s.toFixed(3));
      frame = moving ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      target.x = (event.clientX / innerWidth - 0.5) * 2;
      target.y = (event.clientY / innerHeight - 0.5) * 2;
      kick();
    };
    const onScroll = () => {
      target.s = Math.min(scrollY / 1200, 1);
      kick();
    };
    // Телефон: курсора нет — пятна откликаются на наклон (gamma — влево-вправо, beta — к себе; держат обычно под ~45°)
    const onTilt = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      target.x = Math.max(-1, Math.min(1, event.gamma / 30));
      target.y = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
      kick();
    };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('deviceorientation', onTilt);
    onScroll();
    return () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', onScroll);
      removeEventListener('deviceorientation', onTilt);
      cancelAnimationFrame(frame);
      for (const name of ['--bg-x', '--bg-y', '--bg-s']) layer.style.removeProperty(name);
    };
  }, [liveBg, aurora]);
}
