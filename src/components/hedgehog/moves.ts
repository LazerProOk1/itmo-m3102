import type { useAnimationControls } from 'framer-motion';

type AnimationControls = ReturnType<typeof useAnimationControls>;

/** Ширина бегущего ёжика — та же, что --hog в HedgehogLane.module.css */
export const HOG = 60;
/** Скорость бега, px/с: на ПК дорожка ~1000px — проход за ~3,5 с */
export const SPEED = 290;
/** Один мах галопа, с: короткий и частый — бег, а не прыжки */
export const STRIDE = 0.2;

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Сколько махов уложить в путь: бег и галоп заканчиваются вместе, без рывков */
export const stridesFor = (distance: number) => Math.max(2, Math.round(distance / SPEED / STRIDE));

/**
 * Галоп: низкие частые махи с наклоном вперёд — нос к земле на толчке, чуть выше в полёте
 * (direction: 1 — вправо, -1 — влево). Лапки в это время молотят в CSS (.running в Hedgehog.module.css).
 */
export function gallop(jump: AnimationControls, strides: number, direction: number) {
  return jump.start({
    y: [0, -HOG * 0.11, 0],
    rotate: [7 * direction, 2 * direction, 7 * direction],
    transition: { duration: STRIDE, times: [0, 0.4, 1], ease: ['easeOut', 'easeIn'], repeat: strides - 1 },
  });
}

/** Остановка после бега: выпрямился, чуть «проехал» и присел */
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
