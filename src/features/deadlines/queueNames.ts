import { M3102_STUDENTS, type Student } from '../../data/m3102';

const byLogin = new Map(M3102_STUDENTS.map((student) => [student.github.toLowerCase(), student]));
const simplify = (text: string) => text.toLowerCase().replace(/ё/g, 'е');
const words = (text: string) =>
  simplify(text)
    .split(/[\s.,;:!?()«»"'…-]+/)
    .filter(Boolean);

/** Уменьшительные имён группы: «Федя» в заголовке — то же, что «Федор», а не приписка */
const DIMINUTIVES: Record<string, string[]> = {
  алексей: ['леша', 'лёша'],
  александр: ['саша', 'шура'],
  андрей: ['андрюша'],
  артем: ['тема', 'тёма'],
  даниил: ['даня', 'данил'],
  давид: ['дава'],
  екатерина: ['катя'],
  илья: ['илюша'],
  кирилл: ['кирюша'],
  максим: ['макс'],
  марьяна: ['марьяша'],
  сергей: ['сережа', 'серега'],
  тимофей: ['тима', 'тимоша'],
  федор: ['федя'],
};

/** «Фамилия Имя Отчество» → «Имя Фамилия» */
const shortName = (student: Student) => {
  const [last, first] = student.name.split(' ');
  return first ? `${first} ${last}` : student.name;
};

/** Студент группы по GitHub-логину автора записи — «Имя Фамилия» */
export function studentName(login: string | undefined): string | undefined {
  const student = login ? byLogin.get(login.toLowerCase()) : undefined;
  return student && shortName(student);
}

/**
 * Студент, которого назвали в заголовке по фамилии: записывают и друзей — с аккаунта Андрея приходит
 * «максим еланский». Только если фамилия однозначна; слова короче 4 букв не считаем — «Артём Д» не фамилия.
 */
export function namedStudent(typed: string): string | undefined {
  const typedWords = words(typed).filter((word) => word.length >= 4);
  const found = M3102_STUDENTS.filter((student) => {
    const surname = simplify(student.name.split(' ')[0] ?? '');
    return typedWords.some((word) => surname.startsWith(word));
  });
  return found.length === 1 ? shortName(found[0]!) : undefined;
}

/**
 * Написал ли человек в заголовке что-то сверх своего имени: «андрей (10.10.26)», «Ладно Федя, я начну».
 * Просто «Илья», «Артём Д», «Алексей Громов» — повтор имени, такую приписку не показываем. name — «Имя Фамилия».
 */
export function hasExtraText(typed: string, name: string): boolean {
  const parts = simplify(name).split(' ');
  const known = parts.flatMap((part) => [part, ...(DIMINUTIVES[part] ?? []).map(simplify)]);
  return words(typed).some((word) => !known.some((part) => part.startsWith(word)));
}

/** Строка очереди: кто стоит (по фамилии в заголовке, иначе — автор записи) и приписка мелким шрифтом */
export function queuePerson(typed: string, login: string | undefined): { name: string; note?: string } {
  const author = studentName(login);
  const named = namedStudent(typed);
  if (named && named !== author) return { name: named, note: author ? `записал(а) ${author}` : login && `записал(а) @${login}` };
  if (author) return { name: author, note: typed && hasExtraText(typed, author) ? typed : undefined };
  return { name: typed || '(без имени)', note: login && `@${login}` };
}
