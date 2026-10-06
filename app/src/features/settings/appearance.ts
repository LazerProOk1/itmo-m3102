import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore, type DynamicTheme } from './settingsStore';

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

/** Пара акцентов динамической темы: два соседних по кругу оттенка (35–90°), одинаковой яркости — градиент всегда мягкий */
export interface AccentPair {
  a: string;
  b: string;
  at: number;
}

const PAIR_KEY = 'm3102:dynamic-accent';
export const SHUFFLE_EVENT = 'm3102:shuffle-accent';

export function randomPair(): AccentPair {
  const hue = Math.random() * 360;
  const shift = (35 + Math.random() * 55) * (Math.random() < 0.5 ? -1 : 1);
  const chroma = () => 0.15 + Math.random() * 0.05;
  return { a: customAccent(hue, chroma()), b: customAccent((hue + shift + 360) % 360, chroma()), at: Date.now() };
}

const MINUTE = 60_000;
/** Через сколько менять пару; «случайно» — каждый раз от 3 до 20 минут */
export const dynamicDelay = (mode: DynamicTheme) => (mode === 'random' ? (3 + Math.random() * 17) * MINUTE : Number(mode) * MINUTE);

function loadPair(): AccentPair | null {
  try {
    const value = JSON.parse(localStorage.getItem(PAIR_KEY) ?? 'null') as AccentPair | null;
    return value && parseCustomAccent(value.a) && parseCustomAccent(value.b) && typeof value.at === 'number' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Текущая пара динамической темы (null — выключена). Пара переживает перезагрузку: пока не вышло время, остаётся прежней;
 * «При запуске» — новая на каждое открытие. Сменить сразу — событие SHUFFLE_EVENT (кнопка в настройках).
 */
function useDynamicPair(mode: DynamicTheme): AccentPair | null {
  const [pair, setPair] = useState<AccentPair | null>(null);

  useEffect(() => {
    if (mode === 'off') {
      setPair(null);
      return undefined;
    }
    let timer = 0;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (mode !== 'launch') timer = window.setTimeout(next, delay);
    };
    function next() {
      const fresh = randomPair();
      try {
        localStorage.setItem(PAIR_KEY, JSON.stringify(fresh));
      } catch {
        // без хранилища пара просто не переживёт перезагрузку
      }
      setPair(fresh);
      schedule(dynamicDelay(mode));
    }
    const saved = loadPair();
    const left = saved && mode !== 'launch' ? dynamicDelay(mode) - (Date.now() - saved.at) : 0;
    if (saved && left > 0) {
      setPair(saved);
      schedule(left);
    } else next();
    addEventListener(SHUFFLE_EVENT, next);
    return () => {
      clearTimeout(timer);
      removeEventListener(SHUFFLE_EVENT, next);
    };
  }, [mode]);

  return pair;
}

/**
 * Оформление на <html>: --accent-base и --accent-base-2 (из них в tokens.css считаются все оттенки и градиент),
 * data-aurora / data-glow / data-radius — по ним включаются слои из styles/aurora.css.
 */
export function useApplyAppearance() {
  // Только нужные поля (useShallow): хук живёт в AppShell — родителе страницы, и подписка на весь стор
  // перерисовывала бы страницу при любой настройке (например, при сворачивании меню — лаги на конспекте)
  const { accent, accent2, dynamicTheme, aurora, glow, liveBg, radius, density } = useSettingsStore(
    useShallow(({ accent, accent2, dynamicTheme, aurora, glow, liveBg, radius, density }) => ({
      accent,
      accent2,
      dynamicTheme,
      aurora,
      glow,
      liveBg,
      radius,
      density,
    })),
  );
  const pair = useDynamicPair(dynamicTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-base', pair?.a ?? accentColor(accent));
    // «Авто» — значение по умолчанию из tokens.css (первый цвет, повёрнутый по оттенку)
    const second = pair?.b ?? (accent2 === 'auto' ? null : accentColor(accent2));
    if (second) root.style.setProperty('--accent-base-2', second);
    else root.style.removeProperty('--accent-base-2');
    root.dataset.aurora = aurora ? 'on' : 'off';
    root.dataset.glow = glow ? 'on' : 'off';
    root.dataset.radius = radius;
    root.dataset.density = density;
  }, [accent, accent2, pair, aurora, glow, radius, density]);

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
