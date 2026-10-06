import { expect, it } from 'vitest';
import { pageStarts } from './notePdf';

it('листы режутся по границам блоков; заголовок уходит вместе со следующим блоком; высокий блок — по высоте листа', () => {
  const block = (top: number, bottom: number, heading = false) => ({ top, bottom, heading });
  // Всё влезает — один лист
  expect(pageStarts([block(0, 300), block(310, 600)], 1000)).toEqual([0]);
  // Третий блок не влезает — новый лист с его верха
  expect(pageStarts([block(0, 400), block(410, 800), block(810, 1200)], 1000)).toEqual([0, 810]);
  // Перед ним заголовок — лист начинается с заголовка
  expect(pageStarts([block(0, 700), block(710, 750, true), block(760, 1100)], 1000)).toEqual([0, 710]);
  // Блок выше листа — режется по 1000
  expect(pageStarts([block(0, 100), block(110, 2600)], 1000)).toEqual([0, 110, 1110, 2110]);
});
