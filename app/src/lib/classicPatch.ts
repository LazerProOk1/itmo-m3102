/**
 * Правки в index.html классического сайта группы при сборке сайта (scripts/assemble-classic.ts): сам его файл в корне
 * репозитория не меняем, все отличия — только в собранной копии. Что и зачем:
 *  - service worker не регистрируем: у нас тот же домен и свой воркер, два воркера делили бы кеши;
 *  - манифест убираем: «установить как приложение» остаётся за приложением (/app/);
 *  - помечаем сторону (data-site-style) и подключаем общий переключатель стиля (switch/site-switch.js, лежит рядом) — в
 *    <head>, чтобы слой перехода появился до первой отрисовки.
 */
export function patchClassicIndex(html: string): string {
  if (!html.includes('</head>'))
    throw new Error('В index.html классического сайта группы нет </head> — разметка изменилась, нужно поправить patchClassicIndex.');
  return html
    .replace(/navigator\.serviceWorker\.register\([^)]*\)(\.catch\(\(\) => \{\}\))?/g, 'Promise.resolve()')
    .replace(/<link[^>]*rel=["']manifest["'][^>]*>\s*/g, '')
    .replace(/<html(\s|>)/, '<html data-site-style="classic"$1')
    .replace('</head>', '    <script src="./switch/site-switch.js" charset="utf-8"></script>\n  </head>');
}
