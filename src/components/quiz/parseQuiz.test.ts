import { describe, expect, it } from 'vitest';
import { isQuizPage, matchesAnswer, parseQuiz, quizPageSource, quizPageToMarkdown } from './parseQuiz';

const SOURCE = `title: Тест
description: Про сортировки

? Какие сортировки устойчивы?
- [x] Вставками :: Равные не перепрыгиваются.
- [ ] Быстрая
- [X] Слиянием
explain: Устойчивость — свойство реализации.

? Сколько адресов при w = 16?
= 65536 | 2^16
correct: Верно.
wrong: Слово из $16$ бит
  даёт $2^{16}$ значений.

? Что выведет код?
~~~cpp
int main() {}
~~~
- [ ] 1
- [x] ничего`;

describe('parseQuiz', () => {
  const quiz = parseQuiz(SOURCE);

  it('заголовок, описание, типы вопросов по числу верных вариантов', () => {
    expect(quiz.title).toBe('Тест');
    expect(quiz.description).toBe('Про сортировки');
    expect(quiz.questions.map((q) => q.type)).toEqual(['multi', 'text', 'single']);
  });

  it('пояснения к вариантам, многострочные поля и блоки кода в вопросе', () => {
    expect(quiz.questions[0]!.options[0]).toEqual({ text: 'Вставками', note: 'Равные не перепрыгиваются.', ok: true });
    expect(quiz.questions[1]!.wrong).toBe('Слово из $16$ бит\nдаёт $2^{16}$ значений.');
    expect(quiz.questions[2]!.question).toBe('Что выведет код?\n~~~cpp\nint main() {}\n~~~');
  });

  it('ошибки формата — с номером строки или вопроса', () => {
    expect(() => parseQuiz('? Вопрос\n- [ ] а\n- [ ] б')).toThrow('вопрос 1: не отмечен верный вариант');
    expect(() => parseQuiz('бред')).toThrow('строка 1');
    expect(() => parseQuiz('title: пусто')).toThrow('нет ни одного вопроса');
  });

  it('ответ текстом: регистр, ё, точка в конце, числа с запятой', () => {
    expect(matchesAnswer(['Ёжик'], ' ежик. ')).toBe(true);
    expect(matchesAnswer(['0.5'], '0,5')).toBe(true);
    expect(matchesAnswer(['65536'], '65537')).toBe(false);
  });

  it('файл-тест: mode: quiz первой строкой или в шапке ---', () => {
    expect(quizPageSource('mode: quiz\ntitle: T\n? a\n= b')).toBe('title: T\n? a\n= b');
    expect(quizPageSource('---\nmode: quiz\ntitle: T\nauthor: x\n---\n? a\n= b')).toBe('title: T\n\n? a\n= b');
    expect(quizPageSource('# Конспект\n? не тест')).toBeNull();
    const markdown = quizPageToMarkdown('mode: quiz\n? a\n= b');
    expect(markdown).toBe('```quiz\nmode: quiz\n? a\n= b\n```');
    expect(isQuizPage('mode: quiz\n? a')).toBe(true);
  });
});

describe('тесты внутри конспекта', () => {
  it('находит блоки ```quiz и строит ключ по названию', async () => {
    const { quizBlocks, noteQuizKey } = await import('./parseQuiz');
    const content = 'Текст\n\n```quiz\ntitle: Первый\n? Вопрос\n= 1\n```\n\n```quiz\n? Без названия\n= 2\n```\n';
    const blocks = quizBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(noteQuizKey('Конспекты/a.md', blocks[0]!)).toBe('note:Конспекты/a.md#Первый');
    expect(noteQuizKey('Конспекты/a.md', blocks[1]!)).toBe('note:Конспекты/a.md#Тест');
    expect(quizBlocks('mode: quiz\ntitle: Страница\n? В\n= 1')).toHaveLength(1);
  });
});
