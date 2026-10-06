// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { localStore } from './storage';

it('нет места — выбрасываем кеш конспектов и всё равно сохраняем личные данные', () => {
  localStorage.setItem('m3102:lecture-notes', 'x'.repeat(100));
  const original = Storage.prototype.setItem;
  // «Квота»: пока лежит кеш конспектов, новое не помещается
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (this.getItem('m3102:lecture-notes') !== null) throw new DOMException('full', 'QuotaExceededError');
    original.call(this, key, value);
  });

  localStore!.setItem('m3102:tasks', { state: { done: 1 }, version: 0 });

  expect(localStorage.getItem('m3102:lecture-notes')).toBeNull();
  expect(JSON.parse(localStorage.getItem('m3102:tasks')!)).toEqual({ state: { done: 1 }, version: 0 });
  vi.restoreAllMocks();
});
