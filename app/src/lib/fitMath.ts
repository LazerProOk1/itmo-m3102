/**
 * Блочные формулы KaTeX (`$$…$$`) на узком экране шире текста: раньше обрезались справа. Теперь формула, которая не
 * помещается, плавно уменьшается до ширины колонки, но не меньше MIN_SCALE (около 14 px: мельче с телефона не прочитать) — а если и так шире,
 * остаётся горизонтальная прокрутка (CSS в Markdown.module.css), как у классического оформления.
 */

/** Размер KaTeX по умолчанию (`.katex { font-size: 1.21em }` в его CSS) */
const KATEX_BASE_EM = 1.21;
/** Во сколько раз можно уменьшить формулу: мельче — не прочитать с телефона */
export const MIN_SCALE = 0.7;

/** Множитель размера, чтобы формула шириной `natural` поместилась в `available`; не больше 1 и не меньше MIN_SCALE */
export function fitScale(natural: number, available: number): number {
  if (!(natural > 0) || !(available > 0) || natural <= available) return 1;
  return Math.max(MIN_SCALE, available / natural);
}

/**
 * Подгоняет все блочные формулы внутри `root`. Чтение размеров и запись размера шрифта разнесены по циклам, чтобы на
 * длинном конспекте браузер пересчитывал раскладку один раз, а не после каждой формулы.
 */
export function fitDisplayMath(root: HTMLElement): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('.katex-display > .katex'));
  for (const katex of items) katex.style.fontSize = '';
  const sizes = items.map((katex) => {
    const display = katex.parentElement as HTMLElement;
    return fitScale(katex.scrollWidth, display.clientWidth);
  });
  items.forEach((katex, index) => {
    const scale = sizes[index]!;
    if (scale < 1) katex.style.fontSize = `${(KATEX_BASE_EM * scale).toFixed(3)}em`;
  });
}
