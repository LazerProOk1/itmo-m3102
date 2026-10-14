import { M3102_STUDENTS, type Student } from '../../data/m3102';

const byLogin = new Map(M3102_STUDENTS.map((student) => [student.github.toLowerCase(), student]));
const simplify = (text: string) => text.toLowerCase().replace(/ё/g, 'е');
const words = (text: string) =>
  simplify(text)
    .split(/[\s.,;:!?()«»"'…-]+/)
    .filter(Boolean);

/** Уменьшительные имён группы: «Федя» в заголовке — то же, что «Федор», а не приписка */
const DIMINUTIVES: Record<string, string[]> = {
  алексей: ['леша', 'алеша', 'леха'],
  александр: ['саша', 'шура', 'саня', 'алекс', 'санек'],
  андрей: ['андрюша', 'андрюха', 'дрюша'],
  арман: ['армаша'],
  артем: ['тема', 'артемка'],
  даниил: ['даня', 'данил', 'даниэль'],
  давид: ['дава', 'давидка'],
  екатерина: ['катя', 'катюша', 'катерина', 'катька'],
  илья: ['илюша', 'илюха'],
  кирилл: ['кира', 'кирюша', 'кирюха'],
  марк: ['маркуша'],
  максим: ['макс', 'максимка', 'максик'],
  марьяна: ['марьяша', 'маряна', 'мариана'],
  радик: ['радий', 'радмир'],
  сергей: ['сережа', 'серега', 'серый'],
  тимофей: ['тима', 'тимоша', 'тимоха'],
  федор: ['федя', 'феденька', 'федька'],
};

/** Слово → номер группы уменьшительных: «Макс» и «Максим» — одно имя */
const aliasGroup = new Map<string, number>();
Object.entries(DIMINUTIVES).forEach(([name, aliases], index) => [name, ...aliases].forEach((word) => aliasGroup.set(simplify(word), index)));
const sameName = (a: string, b: string) => a === b || (aliasGroup.has(a) && aliasGroup.get(a) === aliasGroup.get(b));

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
 * Студент, которого назвали в заголовке: записывают и друзей — с аккаунта Андрея приходит «максим еланский».
 * Сначала по фамилии (слова короче 4 букв не считаем — «Артём Д» не фамилия), затем по имени и инициалу
 * («Макс Е.») или просто по имени, если оно в группе одно («Арман»). Только если студент один: «Артём Д» подходит
 * двоим — тогда это не друг, а сам автор.
 */
export function namedStudent(typed: string): string | undefined {
  const typedWords = words(typed);
  const bySurname = M3102_STUDENTS.filter((student) => {
    const surname = simplify(student.name.split(' ')[0] ?? '');
    return typedWords.some((word) => word.length >= 4 && surname.startsWith(word));
  });
  if (bySurname.length === 1) return shortName(bySurname[0]!);
  // Одно слово — только имя целиком («Арман»): буква или «Тема» из двух-трёх знаков слишком расплывчаты
  if (typedWords.length === 0 || typedWords.length > 3 || (typedWords.length === 1 && typedWords[0]!.length < 3)) return undefined;
  const byName = M3102_STUDENTS.filter((student) => {
    const parts = simplify(student.name).split(' ');
    const used = new Set<number>();
    return typedWords.every((word) => {
      const at = parts.findIndex((part, index) => !used.has(index) && (word.length === 1 ? part.startsWith(word) : sameName(part, word)));
      if (at < 0) return false;
      used.add(at);
      return true;
    });
  });
  return byName.length === 1 ? shortName(byName[0]!) : undefined;
}

/**
 * Написал ли человек в заголовке что-то сверх своего имени: «андрей (10.10.26)», «Ладно Федя, я начну».
 * Просто «Илья», «Артём Д», «Алексей Громов» — повтор имени, такую приписку не показываем. name — «Имя Фамилия».
 */
export function hasExtraText(typed: string, name: string): boolean {
  const parts = simplify(name).split(' ');
  const known = parts.flatMap((part) => [part, ...(DIMINUTIVES[part] ?? [])]);
  return words(typed).some((word) => !known.some((part) => part.startsWith(word)));
}

export interface QueuePerson {
  name: string;
  note?: string;
  /** Записал аккаунт, которого нет в списке группы: значок-предупреждение у строки */
  outside?: true;
}

/**
 * Строка очереди: кто стоит (по имени в заголовке, иначе — автор записи) и приписка мелким шрифтом.
 * Предупреждение «не из группы» — про аккаунт, который записывает: студент группы может записать кого угодно.
 */
export function queuePerson(typed: string, login: string | undefined): QueuePerson {
  const author = studentName(login);
  const named = namedStudent(typed);
  const outside = !author && Boolean(login) ? { outside: true as const } : {};
  if (named && named !== author) return { name: named, note: author ? `записал(а) ${author}` : login && `записал(а) @${login}`, ...outside };
  if (author) return { name: author, note: typed && hasExtraText(typed, author) ? typed : undefined };
  return { name: typed || '(без имени)', note: login && `@${login}`, ...outside };
}

/** GitHub-логин студента, который стоит в очереди (не обязательно автор записи) — по нему открывается профиль */
export function queueLogin(typed: string, login: string | undefined): string | undefined {
  const { name } = queuePerson(typed, login);
  return M3102_STUDENTS.find((student) => shortName(student) === name)?.github;
}
