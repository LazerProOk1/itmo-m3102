// Бюджет размера сборки: CI падает, если первая загрузка сайта или одна страница стали тяжелее порога.
// Считается gzip — столько и уходит по сети. Порог подняли осознанно — поменяй число здесь и напиши в коммите почему.
// Запуск после сборки: npm run size
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = {
  /** JS, который качается при открытии сайта (главная + всё, что она тянет) */
  entryJs: 215,
  entryCss: 25,
  /** Сколько JS докачивает одна страница сверх первой загрузки (конспект с Markdown и KaTeX — самая тяжёлая) */
  page: 220,
};

const manifest = JSON.parse(readFileSync('dist/asset-manifest.json', 'utf8'));
const gz = (file) => gzipSync(readFileSync(`dist/${file}`)).length / 1024;
const closure = (key, seen = new Set()) => {
  if (!manifest[key] || seen.has(key)) return seen;
  seen.add(key);
  for (const imported of manifest[key].imports ?? []) closure(imported, seen);
  return seen;
};

const entry = closure('index.html');
const entryJs = [...entry].reduce((sum, key) => sum + gz(manifest[key].file), 0);
const entryCss = [...entry].reduce((sum, key) => sum + (manifest[key].css ?? []).reduce((total, css) => total + gz(css), 0), 0);
const pages = Object.entries(manifest)
  .filter(([key, chunk]) => chunk.isDynamicEntry && key.endsWith('Page.tsx'))
  .map(([key]) => ({
    page: key.split('/').pop(),
    kb: [...closure(key)].filter((item) => !entry.has(item)).reduce((sum, item) => sum + gz(manifest[item].file), 0),
  }))
  .sort((a, b) => b.kb - a.kb);

const failures = [];
const report = (name, kb, budget) => {
  console.log(`${kb > budget ? '✗' : '✓'} ${name}: ${kb.toFixed(0)} КБ gzip (порог ${budget})`);
  if (kb > budget) failures.push(name);
};
report('первая загрузка, JS', entryJs, BUDGET_KB.entryJs);
report('первая загрузка, CSS', entryCss, BUDGET_KB.entryCss);
for (const { page, kb } of pages.slice(0, 5)) report(page, kb, BUDGET_KB.page);
for (const { page, kb } of pages.slice(5)) if (kb > BUDGET_KB.page) report(page, kb, BUDGET_KB.page);

if (failures.length) {
  console.error(`\nСборка тяжелее бюджета: ${failures.join(', ')}. Что-то большое попало в общий код? Подключи лениво (lazy / import()).`);
  process.exit(1);
}
