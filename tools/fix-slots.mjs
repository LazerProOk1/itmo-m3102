#!/usr/bin/env node
/*
  tools/fix-slots.mjs — правка «Колючего куша»: размеры, «Удвоить или ничего», недосчитанные комбинации.

  Запуск из корня репозитория:
    node tools/fix-slots.mjs                 — применить и откалибровать RTP (≈1–3 минуты)
    node tools/fix-slots.mjs --dry           — только проверить, что все якоря найдены (ничего не пишет)
    node tools/fix-slots.mjs --no-calibrate  — без калибровки
    node tools/fix-slots.mjs --root <dir>

  Что делает
  1. js/slots-math.js — evaluate(): серия из 3+ одинаковых символов (Wild заменяют) на соседних барабанах
     вдоль любой из 20 линий теперь считается С ЛЮБОГО барабана, а не только с первого.
     Раньше платили лишь серии, начинающиеся на 1-м барабане, поэтому тройки на барабанах 2–4 / 3–5,
     диагонали в середине и справа (апельсины, C++ и т. д.) «ничего не давали».
     Каждая серия платит один раз (считается от самого левого барабана, откуда её можно продолжить).
     Каждая запись в lines получила cells: [[барабан, ряд], …] — по ним интерфейс рисует подсветку.
  2. js/slots.js — подсветка по lines[i].cells (с любого барабана), обновлён текст «Выплаты».
  3. css/slots.css — блок slots-upgrade заменён на slots-polish: автомат компактнее; «Удвоить или ничего»
     больше не вылезает за панель ни на десктопе, ни на телефоне; на телефоне табло/жар/гэмбл на всю ширину.
  4. Калибровка: LINE_SCALE подбирается так, чтобы RTP симуляции (12 млн, seed 2026, ставка 10)
     был ≈96.9%; WARM_SCALE — чтобы «тёплые» ленты не меняли RTP. Файл tests/slots.mjs не трогается.
  5. sw.js — номер кэша +1.

  Всё или ничего: пока не найден каждый якорь, на диск не пишется ни байта. После записи каждый JS проверяется
  `node --check`; при ошибке — откат. Повторный запуск безопасен.
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const DRY = args.includes('--dry'), CALIBRATE = !args.includes('--no-calibrate') && !DRY;
const rootAt = args.indexOf('--root');
const root = path.resolve(rootAt >= 0 ? args[rootAt + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const SPINS = Number((args.find(a => a.startsWith('--spins=')) || '').split('=')[1]) || 3000000; // как в tests/slots.mjs
const TARGET_RTP = 96.9;

const P = { css: 'css/slots.css', math: 'js/slots-math.js', ui: 'js/slots.js', sw: 'sw.js' };
const full = rel => path.join(root, rel);
const norm = s => s.replace(/\r\n/g, '\n');
const problems = [];
function readText(rel, required = true) {
  if (!fs.existsSync(full(rel))) { if (required) problems.push(`${rel}: файла нет — запустите из корня репозитория или укажите --root`); return null; }
  const raw = fs.readFileSync(full(rel), 'utf8');
  return { raw, crlf: raw.includes('\r\n'), text: norm(raw) };
}
const count = (text, part) => (part ? text.split(part).length - 1 : 0);
function swap(file, text, find, repl, label, doneMark) {
  if (doneMark && text.includes(doneMark)) return text;
  const n = count(text, find);
  if (n !== 1) { problems.push(`${file} · ${label}: якорь ${n === 0 ? 'не найден' : `найден ${n} раз(а), ожидался 1`} → «${find.slice(0, 70).replace(/\n/g, '⏎')}…»`); return text; }
  return text.replace(find, () => repl);
}

/* ======================= 1. Математика ======================= */
const NEW_LINES_BLOCK = String.raw`  const lines = []; let units = 0;
  // Серия одинаковых символов (Wild заменяют) на соседних барабанах вдоль линии считается с ЛЮБОГО барабана,
  // а не только с первого. Каждая серия платит один раз: её считают от самого левого барабана,
  // откуда она продолжается (левее нет такого же символа или Wild).
  const runFrom = (cells, s) => {
    let target = '', n = 0;
    for (let i = s; i < cells.length; i++) {
      const sym = cells[i];
      if (!isLine(sym)) break;
      if (sym === 'wild') { n++; continue; }
      if (!target) target = sym; else if (sym !== target) break;
      n++;
    }
    return { target, n };
  };
  for (let li = 0; li < LINES.length; li++) {
    const L = LINES[li], cells = L.map((row, i) => grid[i][row]);
    for (let s = 0; s <= REELS - 3; s++) {
      const { target, n } = runFrom(cells, s);
      if (!target || n < 3) continue;
      const left = s > 0 ? cells[s - 1] : null;
      if (left && isLine(left) && (left === 'wild' || left === target)) continue; // это часть более длинной серии, начатой левее
      const pay = PAY[target][n - 3] * LINE_SCALE * scale; units += pay;
      lines.push({ line: li, start: s, sym: target, count: n, pay: pay / 20, cells: L.slice(s, s + n).map((row, k) => [s + k, row]) });
    }
  }
`;
function patchMath(text) {
  if (text.includes('runFrom')) return text;
  const a = text.indexOf('  const lines = []; let units = 0;\n'), b = text.indexOf('  // Вертикаль: три одинаковых символа');
  if (a < 0 || b < 0 || b < a || count(text, '  const lines = []; let units = 0;\n') !== 1) { problems.push(`${P.math} · evaluate: не найден цикл по линиям (ожидался блок между «const lines = []» и «// Вертикаль»)`); return text; }
  text = text.slice(0, a) + NEW_LINES_BLOCK + text.slice(b);
  text = swap(P.math, text, 'lines.push({ line: -1, col: r, sym: target, count: 3, pay: pay / 20 });',
    'lines.push({ line: -1, col: r, sym: target, count: 3, pay: pay / 20, cells: [0, 1, 2].map(row => [r, row]) });', 'вертикаль: cells', 'cells: [0, 1, 2].map(row => [r, row])');
  // самые крупные выплаты показываем первыми (линий теперь больше, а интерфейс анимирует первые 10)
  text = swap(P.math, text, '  let scatter = 0; const bonusReels = [];', '  lines.sort((x, y) => y.pay - x.pay);\n  let scatter = 0; const bonusReels = [];', 'сортировка линий', 'lines.sort((x, y) => y.pay - x.pay);');
  return text;
}
const getConst = (text, name) => Number(new RegExp(`export const ${name} = ([\\d.]+);`).exec(text)?.[1]);
const setConst = (text, name, v) => text.replace(new RegExp(`export const ${name} = [\\d.]+;`), `export const ${name} = ${v};`);

/* ======================= 2. Интерфейс ======================= */
function patchUi(text) {
  text = swap(P.ui, text, 'const lineCells = l => (l.col !== undefined', 'const lineCells = l => l.cells || (l.col !== undefined', 'lineCells по cells', 'const lineCells = l => l.cells ||');
  text = swap(P.ui, text, 'Выплаты — в долях общей ставки за каждую выигрышную линию (слева направо, с 1-го барабана). 20 линий.',
    'Выплаты — в долях общей ставки за каждую выигрышную линию. Три и более одинаковых символа подряд на соседних барабанах платят с любого барабана, не только с первого; Wild заменяют. 20 линий.', 'таблица выплат: вступление', 'платят с любого барабана');
  text = swap(P.ui, text, '<li><b>Вертикаль</b> — три одинаковых символа в одном барабане тоже платят как три в линии (Wild заменяют).</li>',
    '<li><b>Вертикаль и диагонали</b> — три одинаковых символа в одном барабане платят как три в линии; диагонали, V-образные и зигзагообразные серии тоже считаются, с любого барабана.</li>', 'таблица выплат: вертикаль', 'Вертикаль и диагонали');
  return text;
}

/* ======================= 3. CSS ======================= */
const CSS_START = '/* slots-polish:start */', CSS_END = '/* slots-polish:end */';
const CSS = `${CSS_START}
/* ---- размеры: компактнее, чем в slots-upgrade ---- */
.wrap:has(.slots-page){max-width:min(1360px,100%)}
.slots-page{max-width:1240px;width:100%;margin:0 auto}
.sl-intro{margin:24px 0 12px}
.sl-intro h1{font-size:clamp(2rem,3.4vw,2.9rem);margin:6px 0}
.sl-poke svg{width:60px;height:60px}
.sl-hud{gap:8px}
.sl-stat{padding:9px 12px}
.sl-stat b{font-size:1.15rem}
.sl-machine{padding:16px}
.sl-cab{grid-template-columns:200px minmax(0,1fr) 104px;gap:16px}
/* барабаны: не шире 960px и не выше экрана */
.sl-mid{width:100%;max-width:max(320px,min(960px,calc((100vh - 280px) * 5 / 3)));margin:0 auto}

/* ---- пульт слева ---- */
.sl-controls.sl-side{gap:8px;min-width:0}
.sl-side>*{min-width:0}
.sl-side .btn2,.sl-side select{min-height:44px;font-size:.92rem;padding:8px 10px}
.sl-side .sl-bet{grid-template-columns:44px minmax(0,1fr) 44px}
.sl-side .sl-bet .btn2{padding:0}
.sl-side .sl-bet output{font-size:1.3rem}
.sl-winbar{margin:4px 0;gap:4px 10px}
.sl-winbar b{font-size:1.6rem}
.sl-heat{flex-wrap:wrap;gap:4px 8px;margin:2px 0}
.sl-heatbar{flex-wrap:nowrap}
.sl-heatbar i svg{width:14px;height:14px}

/* ---- «Удвоить или ничего»: всё в колонку, ничего не вылезает ---- */
.sl-gamble{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin:6px 0 0;padding:10px;min-width:0}
.sl-gamble[hidden]{display:none}
.sl-gtxt{display:grid;gap:3px;min-width:0;font-size:.84rem;line-height:1.35}
.sl-gtxt span,.sl-gtxt em{overflow-wrap:anywhere}
.sl-gbtns{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;width:100%;min-width:0}
.sl-gbtns .btn2{display:flex;align-items:center;justify-content:center;gap:4px;width:100%;min-width:0;min-height:44px;padding:8px 6px;font-size:.88rem;line-height:1.15;white-space:nowrap;text-align:center}
.sl-hist{width:auto;min-width:0}
.sl-flip{min-height:44px}

/* ---- рычаг ---- */
.sl-lever{width:96px;min-height:240px}
.sl-lever-slot{width:18px;margin-left:-9px;border-radius:9px}
.sl-lever-arm{width:12px;margin-left:-6px;border-radius:6px}
.sl-lever-knob{width:58px;height:58px;margin-left:-29px;top:calc(36% - 29px + var(--pull) * 33.6%)}
.sl-lever-label{font-size:.72rem;left:-6px;right:-6px}

/* ---- чёрное на чёрном ---- */
.sl-machine .sl-side,.sl-machine .sl-winbar,.sl-machine .sl-heat,.sl-machine .sl-gamble{color:#fff}
.sl-black{background:#1a1a24!important;color:#fff!important;border-color:rgba(255,255,255,.45)!important}
.sl-red{background:#c4232f!important;color:#fff!important;border-color:rgba(255,255,255,.45)!important}
.sl-quip{color:var(--text)!important;background:var(--card)!important}
.sl-card-black{color:#1a1a24}.sl-card-red{color:#d2485b}

@media(max-width:760px){
  .slots-page{max-width:100%}
  .sl-intro{margin:16px 0 10px}
  .sl-machine{padding:8px}
  .sl-cab{grid-template-columns:minmax(0,1fr) 68px;grid-template-areas:"mid lever" "side side";gap:8px}
  .sl-mid{grid-area:mid;max-width:none}
  .sl-leverbox{grid-area:lever}
  .sl-controls.sl-side{grid-area:side;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  /* табло, жар и гэмбл раньше попадали в половину сетки и сжимались — теперь на всю ширину */
  .sl-side .sl-bet,.sl-side .sl-winbar,.sl-side .sl-heat,.sl-side .sl-gamble,.sl-side .sl-autoopts,.sl-side #sl-free,.sl-side #sl-stop{grid-column:1/-1}
  .sl-side .sl-tools{display:contents}
  .sl-side .btn2,.sl-side select{min-height:46px}
  .sl-winbar b{font-size:1.4rem}
  .sl-gbtns{grid-template-columns:repeat(3,minmax(0,1fr))}
  .sl-lever{width:68px;min-height:150px}
  .sl-lever-slot{width:14px;margin-left:-7px}
  .sl-lever-arm{width:10px;margin-left:-5px}
  .sl-lever-knob{width:44px;height:44px;margin-left:-22px;top:calc(36% - 22px + var(--pull) * 33.6%)}
  .sl-lever-label{font-size:.6rem}
}
@media(max-width:380px){
  .sl-gbtns{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sl-gbtns [data-gamble="collect"]{grid-column:1/-1}
}
${CSS_END}
`;
function patchCss(text) {
  const clean = text
    .replace(/\n?\/\* slots-upgrade:start \*\/[\s\S]*?\/\* slots-upgrade:end \*\/\n?/, '\n')
    .replace(/\n?\/\* slots-polish:start \*\/[\s\S]*?\/\* slots-polish:end \*\/\n?/, '\n');
  return `${clean.replace(/\s*$/, '')}\n\n${CSS}`;
}

/* ======================= 4. Симуляция и калибровка ======================= */
let tmpN = 0;
async function importText(text) {
  const file = path.join(os.tmpdir(), `slots-math-${process.pid}-${tmpN++}.mjs`);
  fs.writeFileSync(file, text);
  try { return await import(pathToFileURL(file).href); } finally { try { fs.unlinkSync(file); } catch { /* уже удалён */ } }
}
// то же, что simulate() из tools/slots-tune.mjs, но с внедряемым модулем математики
function simulate(M, { spins, bet = 10, seed = 2026 }) {
  const rng = M.mulberry32(seed), S = M.newSlotsState();
  let wag = 0, base = 0, fs = 0, pick = 0, jp = 0, hits = 0;
  for (let i = 0; i < spins; i++) {
    const { res, parts } = M.playRound(rng, S, bet, {});
    wag += bet; base += parts.base; fs += parts.fs; pick += parts.pick; jp += parts.jp;
    if (res.win > 0) hits++;
  }
  const pool = S.pool - M.SEED_POOL, pct = x => 100 * x / wag;
  return { rtp: pct(base + fs + pick + jp + pool), rtpBase: pct(base), rtpFs: pct(fs), rtpPick: pct(pick), rtpJp: pct(jp + pool), hit: 100 * hits / spins };
}
// то же, что run() в тесте «горячая серия»
function warmRun(M, set, scale) {
  const rng = M.mulberry32(99); let w = 0, h = 0; const n = 4000000;
  for (let i = 0; i < n; i++) { const { raw } = M.spinGrid(rng, set); const x = M.evaluate(raw, 1, scale).win; w += x; if (x > 0) h++; }
  return { rtp: 100 * w / n, hit: 100 * h / n };
}
const f2 = v => v.toFixed(2);
async function calibrate(text) {
  const points = []; let scale = getConst(text, 'LINE_SCALE'), best = null;
  for (let i = 0; i < 6; i++) {
    const t = setConst(text, 'LINE_SCALE', scale);
    process.stdout.write(`  LINE_SCALE ${scale}: считаю ${SPINS} раундов… `);
    const r = simulate(await importText(t), { spins: SPINS });
    console.log(`RTP ${f2(r.rtp)}%, выигрышей ${f2(r.hit)}%`);
    points.push([scale, r.rtp]);
    if (!best || Math.abs(r.rtp - TARGET_RTP) < Math.abs(best.r.rtp - TARGET_RTP)) best = { t, r, scale };
    if (Math.abs(r.rtp - TARGET_RTP) < 0.12) break;
    let next;
    if (points.length === 1) next = scale * TARGET_RTP / r.rtp;
    else { const [[s0, r0], [s1, r1]] = points.slice(-2); next = r1 === r0 ? s1 * 1.1 : s1 + (TARGET_RTP - r1) * (s1 - s0) / (r1 - r0); } // RTP почти линеен по LINE_SCALE
    scale = Math.round(Math.max(0.2, Math.min(8, next)) * 1000) / 1000;
    if (points.some(([s]) => s === scale)) break;
  }
  return best;
}
async function calibrateWarm(text) {
  const M = await importText(text);
  process.stdout.write('  WARM_SCALE: сравниваю «тёплые» и «холодные» ленты… ');
  const cold = warmRun(M, 'cold', 1), w1 = warmRun(M, 'warm', 1), w2 = warmRun(M, 'warm', 1.1);
  const slope = (w2.rtp - w1.rtp) / 0.1;
  let s = slope > 0 ? 1 + (cold.rtp - w1.rtp) / slope : getConst(text, 'WARM_SCALE');
  if (!(s > 0.8 && s < 1.5)) { console.log(`странное значение (${s}), оставляю прежнее`); return text; }
  s = Math.round(s * 1000) / 1000;
  const check = warmRun(M, 'warm', s);
  console.log(`WARM_SCALE ${s}: RTP тёплых ${f2(check.rtp)}% против холодных ${f2(cold.rtp)}%, выигрышей ${f2(check.hit)}% против ${f2(cold.hit)}%`);
  if (check.hit <= cold.hit + 1.5) console.warn('  ⚠ разница в частоте выигрышей тёплых и холодных лент ≤ 1.5 п.п. — тест «горячая серия» может не пройти');
  return setConst(text, 'WARM_SCALE', s);
}
/* ======================= запуск ======================= */
const files = {
  css: readText(P.css), math: readText(P.math), ui: readText(P.ui), sw: readText(P.sw),
};
if (problems.length) { console.error('Установка отменена:\n' + problems.map(p => '  ✗ ' + p).join('\n')); process.exit(2); }

const mathDone = files.math.text.includes('runFrom');
let mathText = patchMath(files.math.text);
const uiText = patchUi(files.ui.text), cssText = patchCss(files.css.text);
if (problems.length) {
  console.error('Установка отменена — ничего не записано. Проблемы:\n' + problems.map(p => '  ✗ ' + p).join('\n'));
  console.error('\nФайлы отличаются от ожидаемых: поправьте якорь в этом скрипте или внесите правку вручную.');
  process.exit(2);
}
console.log(`✓ css/slots.css — блок slots-polish${files.css.text.includes(CSS_START) ? ' обновлён' : ' добавлен (slots-upgrade убран)'}`);
console.log(`${mathDone ? '·' : '✓'} js/slots-math.js — серии с любого барабана${mathDone ? ' (уже применено)' : ''}`);
console.log(`${uiText === files.ui.text ? '·' : '✓'} js/slots.js — подсветка по cells, текст выплат`);
if (DRY) { console.log('\n--dry: все якоря найдены, файлы не менялись.'); process.exit(0); }

if (CALIBRATE && !mathDone) {
  console.log('\nКалибровка (симуляция та же, что в tests/slots.mjs, поэтому итог совпадёт с тестом):');
  const best = await calibrate(mathText);
  mathText = best.t;
  mathText = await calibrateWarm(mathText);
  process.stdout.write('  Итоговая проверка… ');
  const fin = simulate(await importText(mathText), { spins: SPINS });
  console.log(`RTP ${f2(fin.rtp)}%, выигрышей ${f2(fin.hit)}%, база ${f2(fin.rtpBase)}%, фриспины ${f2(fin.rtpFs)}%, поляна ${f2(fin.rtpPick)}%, джекпот ${f2(fin.rtpJp)}%`);
  if (fin.rtp < 96.1 || fin.rtp > 97.7) console.warn('  ⚠ RTP вне окна 96.0–97.8 — запустите скрипт ещё раз (он продолжит с текущего LINE_SCALE) или подправьте LINE_SCALE вручную.');
} else if (!mathDone) console.log('\n⚠ Калибровка пропущена: LINE_SCALE/WARM_SCALE прежние — RTP будет неточным (запустите скрипт без --no-calibrate).');

let swText = files.sw.text;
const m = /const CACHE = 'm3102-shell-v(\d+)';/.exec(swText);
if (m) swText = swText.replace(m[0], `const CACHE = 'm3102-shell-v${Number(m[1]) + 1}';`); else console.warn('⚠ sw.js: «const CACHE = …» не найден — поднимите номер кэша вручную.');

const writes = [
  [P.css, files.css, cssText], [P.math, files.math, mathText], [P.ui, files.ui, uiText], [P.sw, files.sw, swText],
];
const done = [];
const rollback = () => { for (const [rel, orig] of done.reverse()) fs.writeFileSync(full(rel), orig.raw); };
try {
  for (const [rel, orig, next] of writes) {
    if (next === orig.text) continue;
    done.push([rel, orig]); fs.writeFileSync(full(rel), orig.crlf ? next.replace(/\n/g, '\r\n') : next);
  }
  for (const [rel] of done) if (/\.m?js$/.test(rel)) {
    const r = spawnSync(process.execPath, ['--check', full(rel)], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${rel}: ${r.stderr.trim().split('\n').slice(0, 4).join(' | ')}`);
  }
} catch (error) { rollback(); console.error(`\n✗ Проверка после записи не прошла, изменения откатены.\n  ${error.message}`); process.exit(3); }

console.log(`\nГотово. Изменено файлов: ${done.length}. Дальше посмотрите #/slots на десктопе и телефоне.`);
console.log('Откат: git checkout -- css/slots.css js/slots-math.js js/slots.js sw.js');
