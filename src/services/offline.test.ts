import { expect, it } from 'vitest';
import { offlinePlan } from './offline';

it('без интернета: качаем PDF и картинки из папок материалов — новые и изменённые, пропавшие удаляем', () => {
  const files = [
    { path: 'Конспекты/ДМ/Лекция_1/Логика.pdf', size: 10, sha: 'a2' },
    { path: 'Конспекты/ДМ/img/схема.svg', size: 1, sha: 'b1' },
    { path: 'Материалы/ЛА/Учебник.pdf', size: 50, sha: 'c1' },
    { path: 'Конспекты/ДМ/Лекция_1/Логика.md', size: 5, sha: 'd1' },
    { path: 'Записи лекций/ДМ/лекция.mp3', size: 900, sha: 'e1' },
    { path: 'img/memes/кот.png', size: 3, sha: 'f1' },
  ];
  const plan = offlinePlan(files, { 'Конспекты/ДМ/Лекция_1/Логика.pdf': 'a1', 'Конспекты/ДМ/img/схема.svg': 'b1', 'Конспекты/старое.pdf': 'z' });
  expect(plan.wanted.map((file) => file.path)).toEqual([
    'Конспекты/ДМ/Лекция_1/Логика.pdf',
    'Конспекты/ДМ/img/схема.svg',
    'Материалы/ЛА/Учебник.pdf',
  ]);
  expect(plan.missing.map((file) => file.path)).toEqual(['Конспекты/ДМ/Лекция_1/Логика.pdf', 'Материалы/ЛА/Учебник.pdf']);
  expect(plan.stale).toEqual(['Конспекты/старое.pdf']);
});
