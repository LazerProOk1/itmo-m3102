import type { useAnimationControls } from 'framer-motion';

type AnimationControls = ReturnType<typeof useAnimationControls>;

/** Ширина бегущего ёжика — та же, что --hog в HedgehogLane.module.css */
export const HOG = 60;
/** Дорожка в шапке: скорость бега, px/с (на ПК дорожка ~1000px — проход за ~7 с) и один скачок, с */
export const SPEED = 140;
export const HOP = 0.42;

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Сколько скачков уложить в путь: бег и прыжки заканчиваются вместе, без рывков */
export const hopsFor = (distance: number) => Math.max(2, Math.round(distance / SPEED / HOP));

/** Бег скачками: вверх — замедляясь, вниз — ускоряясь; на подъёме нос задран (direction: 1 — вправо, -1 — влево) */
export function runHops(jump: AnimationControls, hops: number, direction: number) {
  return jump.start({
    y: [0, -HOG * 0.28, 0],
    rotate: [0, -16 * direction, 0],
    transition: { duration: HOP, times: [0, 0.5, 1], ease: ['easeOut', 'easeIn'], repeat: hops - 1 },
  });
}

/**
 * Беглец по всему экрану — галоп, а не прыжки (владелец: «быстро, бегал, скакал»; дорожка в шапке — по-прежнему
 * скачками): ~290 px/с, мах 0,2 с, низкие частые махи с наклоном вперёд. Лапки молотят в CSS (.gallop).
 */
export const GALLOP_SPEED = 290;
export const STRIDE = 0.2;

export const stridesFor = (distance: number) => Math.max(2, Math.round(distance / GALLOP_SPEED / STRIDE));

export function gallop(jump: AnimationControls, strides: number, direction: number) {
  return jump.start({
    y: [0, -HOG * 0.11, 0],
    rotate: [7 * direction, 2 * direction, 7 * direction],
    transition: { duration: STRIDE, times: [0, 0.4, 1], ease: ['easeOut', 'easeIn'], repeat: strides - 1 },
  });
}

/** Остановка после галопа: выпрямился, чуть «проехал» и присел */
export function skid(jump: AnimationControls, direction: number) {
  return jump.start({
    y: 0,
    rotate: [-6 * direction, 0],
    scaleX: [1.08, 1],
    scaleY: [0.9, 1],
    transition: { duration: 0.28, ease: 'easeOut' },
  });
}

/** Присел — высокий кувырок назад, на половине оборота onTurn (развернуться в воздухе) — приземлился с пружинкой */
export async function backflip(jump: AnimationControls, direction: number, onTurn?: () => void) {
  await jump.start({ y: 0, rotate: 0, scaleX: 1.12, scaleY: 0.82, transition: { duration: 0.1, ease: 'easeOut' } });
  const turn = wait(260).then(onTurn);
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
}
