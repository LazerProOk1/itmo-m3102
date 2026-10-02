import { describe, expect, it } from 'vitest';
import { resolveSubjectFolder } from '../data/m3102';
import { cleanTitle, fileUrl, parseLessonFolder, parseStreamFilename, stripFrontMatter, stripVaultSections } from './githubContent';

describe('githubContent', () => {
  it('папка занятия → номер', () => {
    expect(parseLessonFolder('1 лек')).toBe('Лекция 1');
    expect(parseLessonFolder('4 лекция')).toBe('Лекция 4');
    expect(parseLessonFolder('2-3 лек')).toBe('Лекция 2-3');
    expect(parseLessonFolder('2 практика ')).toBe('Практика 2');
    expect(parseLessonFolder('Разное')).toBe('Разное');
    expect(parseLessonFolder('Лекция_2-3')).toBe('Лекция 2-3');
    expect(parseLessonFolder('Доп_Материалы')).toBe('Доп Материалы');
  });

  it('папка предмета: сокращение, полное имя с подчёркиваниями, имя из потока', () => {
    expect(resolveSubjectFolder('ДМ')).toBe('dm');
    expect(resolveSubjectFolder('Линейная_Алгебра')).toBe('linal');
    expect(resolveSubjectFolder('Алгоритмы_и_структуры_данных')).toBe('aisd');
    expect(resolveSubjectFolder('Линейная алгебра и геометрия')).toBe('linal');
    expect(resolveSubjectFolder('img')).toBeUndefined();
  });

  it('front-matter снимается только служебный', () => {
    expect(stripFrontMatter('---\nmain: true\n---\n# Заголовок')).toBe('# Заголовок');
    expect(stripFrontMatter('---\nпросто линия\n---\nтекст')).toBe('---\nпросто линия\n---\nтекст');
  });

  it('файл конспекта 1 потока → номер, название, дата', () => {
    expect(parseStreamFilename('02. Лекция - Предикаты и кванторы (2026-09-09).md')).toEqual({
      lectureNumber: 'Лекция 2',
      title: 'Предикаты и кванторы',
      date: '2026-09-09',
    });
    expect(parseStreamFilename('01. Практикум - Основы работы с консольным Git (2026-09-09).md')?.lectureNumber).toBe('Практикум 1');
    expect(parseStreamFilename('Дискретная математика.md')).toBeNull();
  });

  it('заголовок без LaTeX и префикса', () => {
    expect(cleanTitle('Поле комплексных чисел $\\mathbb{C}$')).toBe('Поле комплексных чисел ℂ');
    expect(cleanTitle('Конспект лекции: Асимптотический анализ')).toBe('Асимптотический анализ');
  });

  it('ссылка на файл экранирует каждый сегмент пути', () => {
    expect(fileUrl('Конспекты/ОП/2 практика /a.md')).toBe(
      'https://redstonelord.github.io/itmo-m3102/%D0%9A%D0%BE%D0%BD%D1%81%D0%BF%D0%B5%D0%BA%D1%82%D1%8B/%D0%9E%D0%9F/2%20%D0%BF%D1%80%D0%B0%D0%BA%D1%82%D0%B8%D0%BA%D0%B0%20/a.md',
    );
  });

  it('описание курса — без разделов «Конспекты» и «Навигация»', () => {
    const text = '> [!info] Курс\n\n---\n\n## 📊 Баллы\n\nтекст\n\n---\n\n## 📚 Конспекты лекций\n\n| № |\n\n---\n\n## 🧭 Навигация\n\n- ссылка\n';
    expect(stripVaultSections(text)).toBe('> [!info] Курс\n\n---\n\n## 📊 Баллы\n\nтекст');
  });
});
