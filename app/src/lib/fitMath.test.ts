import { describe, expect, it } from 'vitest';
import { fitScale, MIN_SCALE } from './fitMath';

describe('fitScale', () => {
  it('помещается — размер не трогаем', () => {
    expect(fitScale(300, 358)).toBe(1);
    expect(fitScale(358, 358)).toBe(1);
  });

  it('чуть шире колонки — уменьшаем ровно до её ширины', () => {
    expect(fitScale(400, 300)).toBeCloseTo(0.75);
  });

  it('сильно шире — не мельче порога, остальное пусть прокручивается', () => {
    expect(fitScale(1000, 300)).toBe(MIN_SCALE);
  });

  it('без размеров (скрытый блок, jsdom) — ничего не делаем', () => {
    expect(fitScale(0, 300)).toBe(1);
    expect(fitScale(500, 0)).toBe(1);
    expect(fitScale(Number.NaN, 300)).toBe(1);
  });
});
