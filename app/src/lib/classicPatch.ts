/**
 * Правки в index.html классического сайта группы при его импорте в /classic (scripts/import-classic.ts): сам его репозиторий не меняем,
 * все отличия — только в копии. Что и зачем:
 *  - service worker не регистрируем: у нас тот же домен и свой воркер, два воркера делили бы кеши;
 *  - манифест убираем: «установить как приложение» остаётся за нашим сайтом;
 *  - подключаем общий переключатель стиля (public/switch/site-switch.js) — в <head>, чтобы слой перехода появился
 *    до первой отрисовки.
 */
export function patchClassicIndex(html: string): string {
  if (!html.includes('</head>'))
    throw new Error('В index.html классического сайта группы нет </head> — разметка изменилась, нужно поправить patchClassicIndex.');
  return html
    .replace(/navigator\.serviceWorker\.register\([^)]*\)(\.catch\(\(\) => \{\}\))?/g, 'Promise.resolve()')
    .replace(/<link[^>]*rel=["']manifest["'][^>]*>\s*/g, '')
    .replace('</head>', '    <script src="../switch/site-switch.js" charset="utf-8"></script>\n  </head>');
}
