import { compareLessons, noteTitle } from '../materials/NoteReader';
import type { LectureNote, Material, Note, SubjectInfo } from '../../types/models';

export interface DigestInput {
  subjectName: string;
  info: SubjectInfo[];
  notes: LectureNote[];
  materials: Material[];
  links: { title: string; url: string }[];
  personalNotes: Note[];
  /** Ссылка на оригинал конспекта (GitHub) */
  sourceUrl: (note: LectureNote) => string | undefined;
  /** Текст PDF-конспекта из индекса поиска группы; нет — в файле будет только ссылка */
  pdfText: (note: LectureNote) => string | undefined;
  date: string;
}

/** Заголовки конспекта на уровень ниже: в файле «# предмет → ## конспект → ### его разделы». Код не трогаем */
export function demoteHeadings(markdown: string, levels = 2): string {
  let fence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (fence) return line;
      return line.replace(/^(#{1,6})(?=\s)/, (hashes) => '#'.repeat(Math.min(6, hashes.length + levels)));
    })
    .join('\n');
}

/**
 * Ссылки с кириллицей как есть: «%D0%9A%D0%BE…» втрое длиннее и съедает токены, а ИИ читает и так.
 * Пробел и скобки оставляем закодированными — иначе сломается [текст](ссылка)
 */
export function readableUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s)<>\]]+/g, (url) => {
    try {
      return decodeURI(url).replace(/[ ()]/g, (char) => ({ ' ': '%20', '(': '%28', ')': '%29' })[char]!);
    } catch {
      return url;
    }
  });
}

/** Примерно токенов: у русского текста в современных токенизаторах ~3 символа на токен */
export const estimateTokens = (text: string) => Math.round(text.length / 3);

function noteBody(note: LectureNote, input: DigestInput): string {
  if (note.contentType === 'markdown') return demoteHeadings(note.content.trim());
  // PDF, загруженный вручную, хранится как data: URI — его в файл не кладём
  if (note.content.startsWith('data:')) return 'Файл загружен на сайт вручную, текста нет.';
  if (note.contentType === 'pdf') {
    const text = input.pdfText(note)?.replace(/\s+/g, ' ').trim();
    return text
      ? `(Текст PDF, извлечён автоматически — формулы и таблицы могут быть искажены)\n\n${text}`
      : `PDF без текста в индексе: ${note.content}`;
  }
  return `Ссылка: ${note.content}`;
}

/**
 * Всё по предмету одним Markdown-файлом — закинуть в ChatGPT / Claude: ИИ не ходит по сайту и не ищет конспекты,
 * а сразу читает всё. Порядок: описание курса, оглавление, конспекты группы, конспекты потока, материалы, свои заметки.
 */
export function buildSubjectDigest(input: DigestInput): string {
  const all = input.notes.filter((note) => !note.archived).sort(compareLessons);
  // У группы занятие часто лежит дважды — .md и PDF того же текста: PDF при живом .md идёт ссылкой, а не копией
  // (иначе файл почти вдвое больше: у ДМ 337 тыс. символов вместо ~225 тыс.)
  const sameLesson = (a: LectureNote, b: LectureNote) => a.lectureNumber === b.lectureNumber;
  const isTwin = (note: LectureNote) =>
    note.contentType === 'pdf' && all.some((other) => other.contentType === 'markdown' && sameLesson(other, note));
  const twinsOf = (note: LectureNote) => (note.contentType === 'markdown' ? all.filter((other) => isTwin(other) && sameLesson(other, note)) : []);
  const visible = all.filter((note) => !isTwin(note));
  const groups = [{ title: 'Конспекты группы М3102', notes: visible }].filter((group) => group.notes.length > 0);

  const out: string[] = [
    `# ${input.subjectName} — все материалы`,
    '',
    `> Собрано с сайта группы М3102 (ИТМО) ${input.date}. Конспекты пишут студенты — в них бывают ошибки и пропуски.`,
    `> Конспектов: ${visible.length}. Отвечая, ссылайся на конспект по его заголовку.`,
    '',
  ];

  for (const item of input.info) out.push(`## ${item.title}`, '', demoteHeadings(item.content.trim()), '');

  if (groups.length) {
    out.push('## Оглавление', '');
    for (const group of groups) {
      out.push(`- ${group.title}`);
      for (const note of group.notes) out.push(`  - ${noteTitle(note)}`);
    }
    out.push('');
  }

  for (const group of groups) {
    out.push(`# ${group.title}`, '');
    for (const note of group.notes) {
      const source = input.sourceUrl(note);
      const twins = twinsOf(note).map((twin) => `PDF-версия: ${twin.content}`);
      out.push(`## ${noteTitle(note)}`, '', ...(source ? [`Источник: ${source}`] : []), ...twins, '', noteBody(note, input), '', '---', '');
    }
  }

  const files = [...input.materials.map((material) => ({ title: material.name, url: material.url })), ...input.links];
  if (files.length) out.push('# Материалы и ссылки', '', ...files.map((file) => `- [${file.title}](${file.url})`), '');

  if (input.personalNotes.length) {
    out.push('# Мои заметки', '');
    for (const note of input.personalNotes) out.push(`## ${note.title}`, '', demoteHeadings(note.content.trim()), '');
  }

  return `${readableUrls(out.join('\n').trim())}\n`;
}
