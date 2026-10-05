// Однократно уменьшает скругления по всему сайту (кроме рамки .home-hero, кругов и «таблеток»).
// Запуск из корня репозитория:  node tools/soften-radii.mjs [коэффициент, по умолчанию 0.7]
// ВАЖНО: запускать один раз (повторный запуск уменьшит скругления ещё раз). Откат — git checkout.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const factor = Number(process.argv[2]) || 0.7;
const files = [
  'site.css', 'index.html', 'js/diagrams/array-player.js',
  ...readdirSync('css').filter(f => f.endsWith('.css') && f !== 'shell.css').map(f => `css/${f}`),
];
// < 6px оставляем (мелкие), >= 100px — «таблетки», % не трогаем
const scale = px => (px < 6 || px >= 100 ? px : Math.max(4, Math.round(px * factor)));
const fixValue = value => value.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `${scale(Number(n))}px`);

let total = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(/([^{}]*)\{([^{}]*)\}/g, (block, selector, body) => {
    if (/\.home-hero(?![\w-])/.test(selector)) return block; // главная рамка с ёжиком остаётся как была
    const next = body.replace(/((?:border(?:-[a-z]+){0,2}-radius|--radius)\s*:\s*)([^;}]+)/g, (_, key, value) => key + fixValue(value));
    if (next !== body) total++;
    return `${selector}{${next}}`;
  });
  if (out !== src) writeFileSync(file, out);
}
console.log(`Готово: изменено правил — ${total}`);
