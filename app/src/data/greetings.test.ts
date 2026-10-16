// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { GREETING_PACKS, GREETINGS, parseGreetingPacks, parseGreetings, pickGreeting, splitAccentPeriod } from './greetings';

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

  it('паки из капсул: GREETING_PACKS читается отдельно от основного списка', () => {
    const source = `export const GREETINGS = ['Ваш учебный день.'];
// Шутки из капсул
export const GREETING_PACKS = {
  cat: ['Кот сидит на конспекте.', 'Мур-мур-мур, Коши.'],
  casino: ['Ставки сделаны.'],
};
function unlocked() { return []; }`;
    expect(parseGreetings(source)).toEqual(['Ваш учебный день.']);
    expect(parseGreetingPacks(source)).toEqual({ cat: ['Кот сидит на конспекте.', 'Мур-мур-мур, Коши.'], casino: ['Ставки сделаны.'] });
    expect(parseGreetingPacks('export const GREETING_PACKS = {};')).toBeNull();
  });

  it('пак попадает в выдачу, только когда выпал в «Колючем куше»', () => {
    const seen = () => new Set(Array.from({ length: 200 }, (_, i) => pickGreeting(() => i / 200)));
    localStorage.removeItem('m3102-slots-v1');
    expect(seen().has(GREETING_PACKS.cat![0]!)).toBe(false);
    localStorage.setItem('m3102-slots-v1', JSON.stringify({ album: { 'greet:cat': 1 } }));
    expect(seen().has(GREETING_PACKS.cat![0]!)).toBe(true);
    expect(seen().has(GREETING_PACKS.rust![0]!)).toBe(false);
    localStorage.removeItem('m3102-slots-v1');
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
