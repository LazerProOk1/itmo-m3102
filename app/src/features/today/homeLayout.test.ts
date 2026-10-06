import { describe, expect, it } from 'vitest';
import { arrangeBlocks, HOME_BLOCKS, moveBlock } from './homeLayout';

describe('раскладка главной', () => {
  it('сохранённый порядок, лишнее выброшено, новые блоки — в конце', () => {
    const order = arrangeBlocks(['deadlines', 'старый-блок', 'schedule', 'deadlines']);
    expect(order.slice(0, 2)).toEqual(['deadlines', 'schedule']);
    expect(order).toHaveLength(HOME_BLOCKS.length);
    expect(new Set(order).size).toBe(HOME_BLOCKS.length);
  });

  it('пустое сохранённое — порядок по умолчанию', () => {
    expect(arrangeBlocks([])).toEqual(HOME_BLOCKS.map((block) => block.id));
  });

  it('шаг вверх и вниз, за край не уходит', () => {
    const order = arrangeBlocks([]);
    expect(moveBlock(order, 'continue', -1).slice(0, 2)).toEqual(['continue', 'next']);
    expect(moveBlock(order, 'next', -1)).toEqual(order);
    expect(moveBlock(order, 'bookmarks', 1)).toEqual(order);
  });
});
