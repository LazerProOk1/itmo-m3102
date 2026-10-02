import { describe, expect, it } from 'vitest';
import { rippleSize } from './ripple';

describe('rippleSize', () => {
  it('круг из точки нажатия достаёт до дальнего угла', () => {
    expect(rippleSize(30, 40, 0, 0)).toBe(100);
    expect(rippleSize(30, 40, 30, 40)).toBe(100);
    expect(rippleSize(60, 80, 30, 40)).toBe(100);
  });
});
