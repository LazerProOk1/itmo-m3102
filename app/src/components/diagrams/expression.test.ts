import { describe, expect, it } from 'vitest';
import { compileExpression } from './expression';

const at = (source: string, x: number, t = 0) => compileExpression(source)({ x, t });

describe('compileExpression', () => {
  it('приоритеты и степень', () => {
    expect(at('x^3/1000 + 0.015*x^2', 10)).toBeCloseTo(1 + 1.5);
    expect(at('-x^2', 3)).toBe(-9);
    expect(at('2^x', 3)).toBe(8);
  });

  it('функции, константы, несколько аргументов', () => {
    expect(at('sqrt(1-(x+0.6)^2)', -0.6)).toBe(1);
    expect(at('min(sqrt(1-(x+0.6)^2), sqrt(1-(x-0.6)^2))', 0)).toBeCloseTo(0.8);
    expect(at('x*log2(x)', 8)).toBe(24);
    expect(at('cos(pi)', 0)).toBe(-1);
    expect(at('-0.6 + cos(t)', 0, 0)).toBeCloseTo(0.4);
  });

  it('неявное умножение', () => {
    expect(at('2x', 4)).toBe(8);
    expect(at('3(x+1)', 1)).toBe(6);
    expect(at('1/x - 1', 0.5)).toBe(1);
  });

  it('ошибки понятные', () => {
    expect(() => compileExpression('x +')).toThrow();
    expect(() => compileExpression('x $ 2')).toThrow();
    expect(() => at('y + 1', 1)).toThrow();
  });
});
