import { describe, expect, it } from 'vitest';
import { GREETINGS, pickGreeting, splitAccentPeriod } from './greetings';

describe('greetings', () => {
  it('одна и та же строка не выпадает два раза подряд', () => {
    const first = pickGreeting(() => 0);
    expect(pickGreeting(() => 0)).not.toBe(first);
    expect(GREETINGS).toContain(first);
  });

  it('акцентная точка — только одиночная', () => {
    expect(splitAccentPeriod('Ваш учебный день.')).toEqual(['Ваш учебный день', '.']);
    expect(splitAccentPeriod('Очевидно, что...')).toEqual(['Очевидно, что...', '']);
    expect(splitAccentPeriod('Вы Апельсин?')).toEqual(['Вы Апельсин?', '']);
  });
});
