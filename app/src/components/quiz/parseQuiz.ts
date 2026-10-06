/**
 * Тесты в конспектах — формат сайта группы (js/quiz.js у RedstoneLord):
 *
 *   title: Название            ← до первого вопроса; ещё description:, mode:
 *   ? Текст вопроса
 *   - [x] верный вариант :: пояснение к варианту
 *   - [ ] неверный вариант
 *   = ответ | другой ответ      ← вместо вариантов — ввод текста
 *   explain: / correct: / wrong: пояснение (можно в несколько строк, блоки ~~~ внутри)
 *   type: single | multi | text (и русские синонимы) — необязательно, проверка
 */

export type QuizQuestionType = 'single' | 'multi' | 'text';

export interface QuizOption {
  text: string;
  note: string;
  ok: boolean;
}

export interface QuizQuestion {
  question: string;
  type: QuizQuestionType;
  options: QuizOption[];
  answers: string[];
  explain: string;
  correct: string;
  wrong: string;
}

export interface QuizData {
  title: string;
  description: string;
  questions: QuizQuestion[];
}

const KEYS: Record<string, 'title' | 'type' | 'explain' | 'correct' | 'wrong'> = {
  title: 'title',
  название: 'title',
  заголовок: 'title',
  type: 'type',
  тип: 'type',
  explain: 'explain',
  объяснение: 'explain',
  пояснение: 'explain',
  correct: 'correct',
  верно: 'correct',
  wrong: 'wrong',
  неверно: 'wrong',
};

const TYPES: Record<string, QuizQuestionType> = {
  single: 'single',
  один: 'single',
  multi: 'multi',
  несколько: 'multi',
  text: 'text',
  текст: 'text',
  ввод: 'text',
};

interface Draft {
  q: string[];
  type: QuizQuestionType | null;
  options: { tl: string[]; nl: string[] | null; ok: boolean }[];
  answers: string[];
  explain: string[];
  correct: string[];
  wrong: string[];
}

export function parseQuiz(source: string): QuizData {
  const lines = source.replace(/\r/g, '').split('\n');
  const data: QuizData = { title: '', description: '', questions: [] };
  const drafts: Draft[] = [];
  let q: Draft | null = null;
  let field: string[] | null = null;
  let fence = false;
  const fail = (n: number, message: string): never => {
    throw new Error(`строка ${n + 1}: ${message}`);
  };

  lines.forEach((raw, n) => {
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();
    if (fence) {
      field!.push(/^~~~$/.test(t) ? '~~~' : line);
      if (t === '~~~') fence = false;
      return;
    }
    if (!t) {
      field?.push('');
      return;
    }
    let m: RegExpExecArray | null;
    if (/^~~~[\w+-]*$/.test(t)) {
      if (!field) fail(n, 'блок ~~~ вне вопроса');
      field!.push(t);
      fence = true;
      return;
    }
    if ((m = /^\?\s*(.*)$/.exec(t))) {
      q = { q: [], type: null, options: [], answers: [], explain: [], correct: [], wrong: [] };
      drafts.push(q);
      field = q.q;
      if (m[1]) field.push(m[1]);
      return;
    }
    if ((m = /^[-*+]\s*\[([ xXхХ])\]\s*(.*)$/.exec(t))) {
      if (!q) return fail(n, 'вариант ответа вне вопроса');
      const [text, ...note] = m[2]!.split(/\s+::\s*/);
      const option = { tl: [text!], nl: note.length ? [note.join(' :: ')] : null, ok: m[1] !== ' ' };
      q.options.push(option);
      field = option.nl ?? option.tl;
      return;
    }
    if ((m = /^=\s*(.+)$/.exec(t))) {
      if (!q) return fail(n, 'ответ «=» вне вопроса');
      q.answers.push(
        ...m[1]!
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean),
      );
      field = null;
      return;
    }
    if (!q && /^(mode|режим)\s*:/i.test(t)) {
      field = null;
      return;
    }
    if (!q && (m = /^(description|описание)\s*:\s*(.*)$/i.exec(t))) {
      data.description = m[2]!.trim();
      field = null;
      return;
    }
    if ((m = /^([A-Za-zА-Яа-яЁё]+)\s*:\s*(.*)$/.exec(t)) && KEYS[m[1]!.toLowerCase()]) {
      const key = KEYS[m[1]!.toLowerCase()]!;
      if (key === 'title' && !q) {
        data.title = m[2]!.trim();
        field = null;
        return;
      }
      if (q && key === 'type') {
        q.type = TYPES[m[2]!.trim().toLowerCase()] ?? fail(n, `неизвестный тип «${m[2]}» (single, multi, text)`);
        field = null;
        return;
      }
      if (q && key !== 'title') {
        field = q[key as 'explain' | 'correct' | 'wrong'];
        if (m[2]) field.push(m[2]);
        return;
      }
    }
    if (field) {
      field.push(raw.replace(/^( {1,4}|\t)/, '').replace(/\s+$/, ''));
      return;
    }
    fail(n, `не понимаю «${t.slice(0, 40)}»`);
  });

  if (fence) throw new Error('не закрыт блок ~~~');
  if (!drafts.length) throw new Error('нет ни одного вопроса (вопрос начинается с «?»)');

  const join = (lines: string[]) => lines.join('\n').trim();
  data.questions = drafts.map((draft, index) => {
    const bad = (message: string): never => {
      throw new Error(`вопрос ${index + 1}: ${message}`);
    };
    const question: QuizQuestion = {
      question: join(draft.q),
      type: 'single',
      options: draft.options.map((option) => ({ text: join(option.tl), note: option.nl ? join(option.nl) : '', ok: option.ok })),
      answers: draft.answers,
      explain: join(draft.explain),
      correct: join(draft.correct),
      wrong: join(draft.wrong),
    };
    if (!question.question) bad('пустой текст вопроса');
    if (draft.answers.length && draft.options.length) bad('нельзя смешивать варианты [ ] и ответы «=»');
    if (draft.answers.length) {
      question.type = 'text';
    } else {
      if (question.options.length < 2) bad('нужно минимум 2 варианта «- [ ]» либо ответ «= …»');
      const right = question.options.filter((option) => option.ok).length;
      if (!right) bad('не отмечен верный вариант (поставьте [x])');
      question.type = right > 1 ? 'multi' : 'single';
      if (draft.type === 'single' && right > 1) bad('тип single, но верных вариантов несколько');
      if (draft.type === 'text') bad('тип text требует строку «= ответ»');
    }
    return question;
  });
  return data;
}

const MODE_RE = /^[ \t]*(mode|режим)[ \t]*:[ \t]*(quiz|тест|викторина)[ \t]*$/i;

/**
 * Файл-тест на всю страницу: начинается с «mode: quiz» (первой строкой или в шапке --- … ---).
 * Возвращает текст теста или null, если это обычный конспект.
 */
export function quizPageSource(raw: string): string | null {
  const text = raw
    .replace(/^﻿/, '')
    .replace(/\r/g, '')
    .replace(/^(\s*\n)+/, '');
  let out: string | null = null;
  const front = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (front) {
    const head = front[1]!.split('\n');
    if (head.some((line) => MODE_RE.test(line))) {
      out = `${head.filter((line) => /^\s*(title|название|заголовок|description|описание)\s*:/i.test(line)).join('\n')}\n\n${text.slice(front[0].length)}`;
    }
  } else {
    const newline = text.indexOf('\n');
    const first = newline < 0 ? text : text.slice(0, newline);
    if (MODE_RE.test(first)) out = newline < 0 ? '' : text.slice(newline + 1);
  }
  if (out === null) return null;
  const fenced = /^\s*```quiz[ \t]*\n([\s\S]*?)\n```\s*$/.exec(out);
  return fenced ? fenced[1]! : out;
}

/** Файл-тест → markdown с одним блоком ```quiz (mode: quiz внутри — тест на всю страницу); иначе текст как есть */
export function quizPageToMarkdown(raw: string): string {
  const quiz = quizPageSource(raw);
  return quiz === null ? raw : `\`\`\`quiz\nmode: quiz\n${quiz}\n\`\`\``;
}

/** Тест на всю страницу: с заставкой «Начать» и управлением с клавиатуры */
export const isQuizPage = (source: string) => MODE_RE.test(source.split('\n')[0] ?? '');

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '');
const asNumber = (value: string) => {
  const text = value.trim().replace(',', '.').replace(/\s/g, '');
  return /^[-+]?\d+(\.\d+)?$/.test(text) ? parseFloat(text) : null;
};

/** Ответ текстом: без учёта регистра, ё/е, лишних пробелов и точки в конце; числа — по значению (0,5 = 0.5) */
export function matchesAnswer(answers: string[], value: string): boolean {
  return answers.some((answer) => normalize(answer) === normalize(value) || (asNumber(value) !== null && asNumber(answer) === asNumber(value)));
}

/** Название теста без полного разбора — для ключа результатов */
export const quizTitle = (source: string) => /^\s*(?:title|название|заголовок)\s*:\s*(.+)$/im.exec(source)?.[1]!.trim() || 'Тест';

/** Ключ результатов теста группы внутри конспекта: путь файла + название теста */
export const noteQuizKey = (sourceRef: string, source: string) => `note:${sourceRef}#${quizTitle(source)}`;

/** Все блоки ```quiz конспекта (файл-тест тоже превращается в один блок) */
export function quizBlocks(content: string): string[] {
  return [...quizPageToMarkdown(content).matchAll(/^```quiz[ \t]*\n([\s\S]*?)\n```/gm)].map((match) => match[1]!);
}
