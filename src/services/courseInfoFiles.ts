/**
 * Встроенные описания курсов (`src/data/courseInfo/{Предмет}.md`). Отдельный модуль и подключается через
 * `import()` только при синхронизации: `import.meta.glob` знает один Vite, а `githubContent.ts` читает
 * ещё и скрипт календаря (`npm run ics`, tsx) — там статический импорт ломал сборку.
 */
export const COURSE_INFO_FILES = import.meta.glob<string>('../data/courseInfo/*.md', { query: '?raw', import: 'default', eager: true });
