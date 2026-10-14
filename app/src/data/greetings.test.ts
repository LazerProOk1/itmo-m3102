import { describe, expect, it } from 'vitest';
import { GREETINGS, parseGreetings, pickGreeting, splitAccentPeriod } from './greetings';

describe('parseGreetings', () => {
  it('берёт строки из js/greetings.js группы, комментарии и код пропускает', () => {
    const source = `/* Правьте строки: 'эта в комментарии не считается' */
export const GREETINGS = [
  'Ваш учебный день.',
  "Двойные кавычки.", // 'и это комментарий'
  'Не бойся, it\\'s fine.'
];
export function pickGreeting() { return ['x']; }`;
    expect(parseGreetings(source)).toEqual(['Ваш учебный день.', 'Двойные кавычки.', "Не бойся, it's fine."]);
  });

  it('актуальный файл группы читается целиком', () => {
    const source = `export const GREETINGS = [\n${GREETINGS.map((line) => `  '${line}',`).join('\n')}\n];`;
    expect(parseGreetings(source)).toEqual(GREETINGS);
  });

  it('нет списка или он пуст — null, остаётся прежний', () => {
    expect(parseGreetings('export const OTHER = [1];')).toBeNull();
    expect(parseGreetings('export const GREETINGS = [];')).toBeNull();
  });
});

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
