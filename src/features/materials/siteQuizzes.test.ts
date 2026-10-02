import { describe, expect, it } from 'vitest';
import { parseQuiz } from '../../components/quiz/parseQuiz';
import { siteQuizFor, siteQuizKey } from './siteQuizzes';

const FILES = import.meta.glob<string>('../../data/siteQuizzes/**/*.md', { query: '?raw', import: 'default', eager: true });

describe('тесты сайта к конспектам', () => {
  it('ключ не зависит от пробелов/подчёркиваний и регистра — переживает автопереименование', () => {
    expect(siteQuizKey('Конспекты/Линейная_Алгебра/Практика_4/Обратная матрица и метод Гаусса.md')).toBe(
      siteQuizKey('../../data/siteQuizzes/Линейная_Алгебра/Практика_4/Обратная_матрица_и_метод_Гаусса.md'),
    );
    expect(siteQuizFor('Конспекты/Алгоритмы_и_структуры_данных/Лекция_1/Асимптотический_анализ_алгоритмов.md')).toBeTypeOf('function');
    expect(siteQuizFor('Конспекты/Нет/такого.md')).toBeUndefined();
  });

  it.each(Object.entries(FILES))('%s разбирается и в нём не меньше 6 вопросов', (_, source) => {
    const quiz = parseQuiz(source);
    expect(quiz.title).not.toBe('');
    expect(quiz.questions.length).toBeGreaterThanOrEqual(6);
  });
});
