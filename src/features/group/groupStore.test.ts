import { expect, it } from 'vitest';
import { isHiddenPath } from './groupStore';

it('служебные файлы сайта группы не попадают в «Файлы группы», материалы — попадают', () => {
  // Добавились у группы с установкой сайта как приложения (05.10.2026)
  expect(isHiddenPath('manifest.webmanifest')).toBe(true);
  expect(isHiddenPath('sw.js')).toBe(true);
  expect(isHiddenPath('site.css')).toBe(true);
  expect(isHiddenPath('img/icons/icon-192.png')).toBe(true);
  expect(isHiddenPath('Лабораторные/ОП/lab1.js')).toBe(false);
  expect(isHiddenPath('Записи лекций/ОП/лекция 1.mp3')).toBe(false);
  expect(isHiddenPath('Конспекты/Основы_программирования/Теормины/Теормин_1.md')).toBe(false);
});
