import { expect, it } from 'vitest';
import { fieldAngle } from './flow';

it('поле течения плавное: конечное, меняется со временем, а соседние точки дают близкие углы', () => {
  for (const [x, y] of [
    [0, 0],
    [320, 480],
    [1900, 1000],
  ] as const) {
    expect(Number.isFinite(fieldAngle(x, y, 0))).toBe(true);
    expect(fieldAngle(x, y, 0)).not.toBeCloseTo(fieldAngle(x, y, 40), 3);
  }
  // На шаге в 1px угол меняется на доли радиана — линии получаются гладкими, без «ломаных»
  expect(Math.abs(fieldAngle(500, 300, 5) - fieldAngle(501, 300, 5))).toBeLessThan(0.02);
});
