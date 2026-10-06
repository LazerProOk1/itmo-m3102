/** Языки fenced-блоков, которые сайт группы рисует картинкой (README их репозитория). Отдельно от DiagramBlock:
 * Markdown проверяет язык сразу, а сам рисовальщик (~400 КБ) грузит, только когда в тексте есть схема */
export const DIAGRAM_LANGUAGES = ['graph', 'plot', 'chart', 'tree', 'array', 'diagram', 'canvas'] as const;
export type DiagramLanguage = (typeof DIAGRAM_LANGUAGES)[number];

export const isDiagramLanguage = (lang: string): lang is DiagramLanguage => (DIAGRAM_LANGUAGES as readonly string[]).includes(lang);
