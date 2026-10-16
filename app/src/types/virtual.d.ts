/** Модули, которые собирает vite.config.ts из файлов группы (сами файлы не меняем) */
declare module 'virtual:classic-palettes' {
  /** Форма — как у `ClassicPalette` в lib/classicPalettes.ts (относительные пути в объявлениях модулей запрещены) */
  const data: { palettes: { id: string; name: string; a: string; b: string; base: boolean }[]; defaultId: string };
  export default data;
}

declare module 'virtual:group-snapshot' {
  /** Дедлайны, ДЗ, ссылки и расписание на момент сборки — как лежат в репозитории группы */
  const snapshot: { deadlines: unknown; homework: unknown; links: unknown; schedule: unknown };
  export default snapshot;
}
