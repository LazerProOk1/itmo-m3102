/**
 * Правки в index.html классического сайта группы при сборке сайта (scripts/assemble-classic.ts): сам его файл в корне
 * репозитория не меняем, все отличия — только в собранной копии. Что и зачем:
 *  - манифест убираем: «установить как приложение» остаётся за приложением (/app/). Его service worker, наоборот,
 *    оставляем: он даёт классическому сайту офлайн-режим и не мешает приложению (у приложения свой воркер на /app/,
 *    свои названия кешей, а страницы /app/ он не перехватывает, пока их ведёт воркер приложения);
 *  - список скрытых файлов его «Материалов» приводим к нижнему регистру: он сравнивает с `base.toLowerCase()`, поэтому
 *    записи «AGENTS.md» и «CLAUDE.md» никогда не совпадали и эти файлы показывались как материалы;
 *  - помечаем сторону (data-site-style) и подключаем общий переключатель стиля (switch/site-switch.js, лежит рядом) — в
 *    <head>, чтобы слой перехода появился до первой отрисовки.
 */
export function patchClassicIndex(html: string): string {
  if (!html.includes('</head>'))
    throw new Error('В index.html классического сайта группы нет </head> — разметка изменилась, нужно поправить patchClassicIndex.');
  return html
    .replace(/<link[^>]*rel=["']manifest["'][^>]*>\s*/g, '')
    .replace(/(HIDDEN_FILE_NAMES\s*=\s*\[)([^\]]*)(\])/, (_all, open: string, list: string, close: string) => open + list.toLowerCase() + close)
    .replace(/<html(\s|>)/, '<html data-site-style="classic"$1')
    .replace('</head>', '    <script src="./switch/site-switch.js" charset="utf-8"></script>\n  </head>');
}
