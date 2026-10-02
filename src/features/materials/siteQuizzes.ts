/**
 * Тесты «Проверь себя» к конспектам M3102, написанные для этого сайта. Лежат в src/data/siteQuizzes
 * по тем же путям, что конспекты в репозитории группы (`Предмет/Лекция_N/Файл.md`), и в репозиторий
 * группы не попадают и оттуда не синхронизируются. Каждый файл грузится отдельно — только когда
 * открыт его конспект.
 */
const FILES = import.meta.glob<string>('../../data/siteQuizzes/**/*.md', { query: '?raw', import: 'default' });

/** Ключ без регистра, пробелов/подчёркиваний и расширения: автопереименование в репозитории группы меняет « » на «_» */
export function siteQuizKey(path: string): string {
  return path
    .normalize('NFC')
    .replace(/^.*?siteQuizzes\//, '')
    .replace(/^Конспекты\//, '')
    .replace(/\.md$/i, '')
    .replace(/[\s_]+/g, '_')
    .toLowerCase();
}

const BY_KEY = new Map(Object.entries(FILES).map(([file, load]) => [siteQuizKey(file), load]));

/** Загрузчик теста к конспекту с путём sourceRef (`Конспекты/…`), если тест есть */
export function siteQuizFor(sourceRef: string | undefined): (() => Promise<string>) | undefined {
  return sourceRef ? BY_KEY.get(siteQuizKey(sourceRef)) : undefined;
}
