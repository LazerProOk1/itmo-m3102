import type { useAnimationControls } from 'framer-motion';

type AnimationControls = ReturnType<typeof useAnimationControls>;

/** Ширина бегущего ёжика — та же, что --hog в HedgehogLane.module.css */
export const HOG = 60;
/** Скорость бега, px/с: на ПК дорожка ~1000px — проход за ~7 с */
export const SPEED = 140;
/** Один скачок на бегу, с */
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
