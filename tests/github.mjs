import test from 'node:test';
import assert from 'node:assert/strict';
import { base64Utf8, mergeHomework, utf8Base64 } from '../js/github.js';
import { applyScheduleChanges } from '../js/schedule.js';

test('UTF-8 кодируется без порчи кириллицы и больших файлов', () => {
  const text = 'М3102 ✨ '.repeat(10000);
  assert.equal(base64Utf8(utf8Base64(text)), text);
});

test('слияние ДЗ сохраняет чужие изменения и локальное удаление', () => {
  const base = { version: 1, items: [{ id: 'a', text: 'старое' }, { id: 'b', text: 'удалить' }] };
  const remote = { version: 1, items: [{ id: 'a', text: 'старое' }, { id: 'b', text: 'удалить' }, { id: 'c', text: 'чужое' }] };
  const local = { version: 1, items: [{ id: 'a', text: 'новое' }] };
  assert.deepEqual(mergeHomework(base, remote, local).items, [{ id: 'a', text: 'новое' }, { id: 'c', text: 'чужое' }]);
});

test('слияние расписания меняет только локально изменённые дни', () => {
  const before = { cycle: Array.from({ length: 14 }, () => []), overrides: {}, anchorMonday: '2026-09-21', anchorParity: 'even', defaultLocation: '', vacations: [] };
  const remote = structuredClone(before), local = structuredClone(before);
  remote.cycle[1] = [{ subject: 'чужое' }]; local.cycle[2] = [{ subject: 'моё' }];
  const result = applyScheduleChanges(before, remote, local);
  assert.equal(result.cycle[1][0].subject, 'чужое');
  assert.equal(result.cycle[2][0].subject, 'моё');
});
