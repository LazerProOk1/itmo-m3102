import { expect, it } from 'vitest';
import { dynamicDelay, parseCustomAccent, randomPair } from './appearance';

it('случайная пара — два разных соседних оттенка, которые читает пипетка', () => {
  for (let index = 0; index < 50; index++) {
    const { a, b } = randomPair();
    const first = parseCustomAccent(a);
    const second = parseCustomAccent(b);
    expect(first && second).toBeTruthy();
    const gap = Math.abs(first!.hue - second!.hue);
    const circle = Math.min(gap, 360 - gap);
    expect(circle).toBeGreaterThanOrEqual(33);
    expect(circle).toBeLessThanOrEqual(90);
  }
});

it('интервалы динамической темы — в минутах', () => {
  expect(dynamicDelay('15')).toBe(15 * 60_000);
  expect(dynamicDelay('60')).toBe(60 * 60_000);
});
