#!/usr/bin/env node
/*
  tools/slots-upgrade.mjs — разовая правка «Колючего куша».

  Что делает:
  1. css/slots.css — дописывает блок (между маркерами, повторный запуск его заменяет):
     • страница автомата занимает почти всю ширину окна, барабаны крупные (но влезают по высоте экрана);
     • рычаг шире (и ручка больше), левая панель шире, все кнопки выше — легче попасть пальцем;
     • исправлен «чёрный текст на чёрном»: кнопки «Чёрное»/«Красное», реплика ёжика в светлой теме.
  2. js/slots-math.js — три одинаковых символа в одном барабане (по вертикали) тоже платят
     (Wild заменяют; сумма считается как 3 в линии × COLUMN_SCALE и идёт под тем же множителем Wild/фриспинов).
  3. js/slots.js — подсветка вертикальной выплаты (вертикальная линия + рамка ячеек) и строка в таблице выплат.
  4. Калибровка: до правки измеряется RTP (симуляция с фиксированным seed), после — LINE_SCALE подбирается так,
     чтобы RTP остался прежним (вертикали добавляют выплаты, остальные выигрыши слегка уменьшаются).

  Запуск (из корня репозитория):
    node tools/slots-upgrade.mjs              # применить и откалибровать
    node tools/slots-upgrade.mjs --dry        # только проверить, что правки подходят
    node tools/slots-upgrade.mjs --no-calibrate
    node tools/slots-upgrade.mjs --spins=3000000
  Потом: npm test (tests/slots.mjs) и посмотреть страницу #/slots.

  Набор из 20 линий не менялся: в нём уже есть все привычные формы 3×5 (3 ряда, V и ^, зигзаги, W/M и т. д.),
  а делитель 20 зашит в выплаты, интерфейс и тесты.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry'), CALIBRATE = !args.includes('--no-calibrate') && !DRY;
const SPINS = Number((args.find(a => a.startsWith('--spins=')) || '').split('=')[1]) || 1500000;
const P = { css: path.join(root, 'css/slots.css'), math: path.join(root, 'js/slots-math.js'), ui: path.join(root, 'js/slots.js') };

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, text) => { if (!DRY) fs.writeFileSync(file, text); };
function must(text, find, label) { if (!text.includes(find)) throw new Error(`Не нашёл место для правки «${label}». Файл изменился? Правка не применена.`); }
function swap(text, find, repl, label) { must(text, find, label); return text.replace(find, () => repl); }

/* ---------- измерение RTP ---------- */
async function measure(file, spins) {
  const M = await import(`${pathToFileURL(file).href}?t=${Date.now()}${Math.random()}`);
  const rng = M.mulberry32(20261016), S = M.newSlotsState(), bet = 5;
  let staked = 0, won = 0;
  for (let i = 0; i < spins; i++) { staked += bet; won += M.rollRound(rng, S, bet, {}, { paid: true }).won; }
  return won / staked;
}

/* ---------- 1. CSS ---------- */
const CSS_START = '/* slots-upgrade:start */', CSS_END = '/* slots-upgrade:end */';
const CSS = `${CSS_START}
/* страница на всю ширину окна */
.wrap:has(.slots-page){max-width:min(1900px,100%)}
.slots-page{max-width:none;width:100%}
.sl-machine{padding:22px}
.sl-cab{grid-template-columns:230px minmax(0,1fr) 150px;gap:22px}
/* барабаны: максимум по ширине, но не выше экрана */
.sl-mid{width:100%;max-width:max(320px,calc((100vh - 170px) * 5 / 3));margin:0 auto}

/* крупные кнопки пульта */
.sl-controls.sl-side{gap:10px}
.sl-side .btn2,.sl-side select{min-height:56px;font-size:1.02rem}
.sl-side .sl-bet{grid-template-columns:58px 1fr 58px}
.sl-side .sl-bet output{font-size:1.5rem}
.sl-winbar b{font-size:2rem}
.sl-gamble .btn2{min-height:52px;font-size:1rem}
.sl-gbtns{width:100%}.sl-gbtns .btn2{flex:1 1 0}

/* рычаг шире */
.sl-lever{width:130px;min-height:320px}
.sl-lever-slot{width:24px;margin-left:-12px;border-radius:12px}
.sl-lever-arm{width:16px;margin-left:-8px;border-radius:8px}
.sl-lever-knob{width:76px;height:76px;margin-left:-38px;top:calc(36% - 38px + var(--pull) * 33.6%)}
.sl-lever-label{font-size:.82rem;left:-10px;right:-10px}

/* чёрное на чёрном */
.sl-machine .sl-side,.sl-machine .sl-winbar,.sl-machine .sl-heat,.sl-machine .sl-gamble{color:#fff}
.sl-black{background:#1a1a24!important;color:#fff!important;border-color:rgba(255,255,255,.45)!important}
.sl-red{background:#c4232f!important;color:#fff!important;border-color:rgba(255,255,255,.45)!important}
.sl-quip{color:var(--text)!important;background:var(--card)!important}
.sl-card-black{color:#1a1a24}.sl-card-red{color:#d2485b}

@media(max-width:760px){
  .sl-machine{padding:10px}
  .sl-cab{grid-template-columns:minmax(0,1fr) 96px;gap:10px}
  .sl-mid{max-width:none}
  .sl-lever{width:96px;min-height:220px}
  .sl-lever-knob{width:60px;height:60px;margin-left:-30px;top:calc(36% - 30px + var(--pull) * 33.6%)}
  .sl-lever-slot{width:20px;margin-left:-10px}.sl-lever-arm{width:13px;margin-left:-6.5px}
  .sl-side .btn2,.sl-side select{min-height:54px}
}
${CSS_END}
`;
function patchCss(text) {
  const clean = text.replace(new RegExp(`\\n?${CSS_START.replace(/[/*]/g, '\\$&')}[\\s\\S]*?${CSS_END.replace(/[/*]/g, '\\$&')}\\n?`), '\n');
  return `${clean.replace(/\s*$/, '')}\n\n${CSS}`;
}

/* ---------- 2. математика ---------- */
function patchMath(text) {
  if (text.includes('COLUMN_SCALE')) return text;
  text = swap(text, /export const LINE_SCALE = [\d.]+;[^\n]*\n/.exec(text)?.[0] ?? '§', (/export const LINE_SCALE = [\d.]+;[^\n]*\n/.exec(text) || [''])[0]
    + 'export const COLUMN_SCALE = 1; // выплата за 3 одинаковых символа в одном барабане = PAY[символ][0] × COLUMN_SCALE (по вертикали)\n', 'COLUMN_SCALE');
  const find = '  let scatter = 0; const bonusReels = [];';
  const add = `  // Вертикаль: три одинаковых символа в одном барабане (Wild заменяют; барабан только из Wild не платит)
  for (let r = 0; r < REELS; r++) {
    const col = grid[r]; let target = '', ok = col.every(isLine);
    for (const s of col) { if (!ok) break; if (s === 'wild') continue; if (!target) target = s; else if (s !== target) ok = false; }
    if (ok && target) { const pay = PAY[target][0] * COLUMN_SCALE * LINE_SCALE * scale; units += pay; lines.push({ line: -1, col: r, sym: target, count: 3, pay: pay / 20 }); }
  }
`;
  return swap(text, find, add + find, 'evaluate: вертикали');
}
const setLineScale = (text, v) => text.replace(/export const LINE_SCALE = [\d.]+;/, `export const LINE_SCALE = ${v};`);
const getLineScale = text => Number(/export const LINE_SCALE = ([\d.]+);/.exec(text)[1]);

/* ---------- 3. интерфейс ---------- */
function patchUi(text) {
  if (text.includes('lineCells')) return text;
  text = swap(text, '  async function showLines(res, quick) {',
    "  const lineCells = l => (l.col !== undefined ? [0, 1, 2].map(row => [l.col, row]) : M.LINES[l.line].slice(0, l.count).map((row, i) => [i, row]));\n  async function showLines(res, quick) {", 'showLines: helper');
  text = swap(text, "const L = M.LINES[l.line], pts = L.slice(0, l.count).map((row, i) => `${i * 100 + 50},${row * 100 + 50}`).join(' ');",
    "const cells = lineCells(l), pts = (l.col !== undefined ? [[l.col, 0.1], [l.col, 2.9]] : cells).map(([r, row]) => `${r * 100 + 50},${row * 100 + 50}`).join(' ');", 'showLines: точки');
  text = swap(text, 'L.slice(0, l.count).forEach((row, i) => { const c = cellsOf(i, [row])[0]; if (c)',
    'cells.forEach(([r, row]) => { const c = cellsOf(r, [row])[0]; if (c)', 'showLines: ячейки');
  text = swap(text, "res.lines.slice(10).forEach(l => M.LINES[l.line].slice(0, l.count).forEach((row, i) => cellsOf(i, [row])[0]?.classList.add('is-win')));",
    "res.lines.slice(10).forEach(l => lineCells(l).forEach(([r, row]) => cellsOf(r, [row])[0]?.classList.add('is-win')));", 'showLines: хвост');
  text = swap(text, '<li>🔥 <b>Жар</b>',
    '<li><b>Вертикаль</b> — три одинаковых символа в одном барабане тоже платят как три в линии (Wild заменяют).</li>\n      <li>🔥 <b>Жар</b>', 'таблица выплат');
  return text;
}

/* ---------- запуск ---------- */
try {
  const css = patchCss(read(P.css));
  const originalMath = read(P.math);
  const alreadyPatched = originalMath.includes('COLUMN_SCALE');
  const math = patchMath(originalMath);
  const ui = patchUi(read(P.ui));

  let before = null;
  if (CALIBRATE && !alreadyPatched) { process.stdout.write(`Измеряю RTP до правки (${SPINS} раундов)… `); before = await measure(P.math, SPINS); console.log(`${(before * 100).toFixed(2)}%`); }

  write(P.css, css); write(P.ui, ui); write(P.math, math);
  console.log(DRY ? 'Проверка пройдена: все правки подходят (ничего не записано).' : 'Файлы обновлены: css/slots.css, js/slots-math.js, js/slots.js.');

  if (CALIBRATE) {
    if (before === null) console.log('Вертикали уже были добавлены раньше — калибровку пропускаю.');
    else {
      let scale = getLineScale(math);
      for (let i = 0; i < 5; i++) {
        const now = await measure(P.math, SPINS);
        console.log(`  RTP после правки: ${(now * 100).toFixed(2)}% (LINE_SCALE ${scale})`);
        if (Math.abs(now - before) < 0.0015) break;
        scale = Math.round(scale * Math.max(0.5, Math.min(1.5, before / now)) * 1000) / 1000;
        write(P.math, setLineScale(read(P.math), scale));
      }
      console.log(`Готово: LINE_SCALE = ${scale}. Если tests/slots.mjs проверяет точное значение — обновите тест.`);
    }
  }
} catch (error) { console.error(`✗ ${error.message}`); process.exit(1); }
