/** Типы для файлов классической версии, которые приложение читает при сборке (сами файлы не меняем) */
declare module '*/js/greetings.js' {
  export const GREETINGS: string[];
  export const GREETING_PACKS: Record<string, string[]>;
}
