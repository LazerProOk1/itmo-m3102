#!/usr/bin/env node
/*
  tools/slots-rtp120.mjs — «Колючий куш»: выигрыши ≤ 0.5× ставки считаются проигрышами, RTP ≈ 120%.

  Что делает:
    1. Патчит js/slots-math.js (идемпотентно):
       - добавляет LOSS_X = 0.5;
       - «жар» (heat) сбрасывается только выигрышем > LOSS_X × ставки;
       - множитель фриспинов растёт только после выигрышного спина > LOSS_X × ставки;
       - winTier() считает выигрыш ≤ LOSS_X × ставки уровнем 'none'.
       (Сами ягоды по-прежнему выплачиваются — мелочь просто не считается «победой».)
    2. Подбирает LINE_SCALE (масштаб линейных выплат; влияет и на фриспины) методом секущих
       на N спинов (по умолчанию 4 000 000) с одним и тем же seed — функция RTP(scale) получается гладкой.
    3. Проверяет результат на других seed и записывает js/slots-math.js (бэкап — slots-math.js.bak).

  Запуск (из корня репозитория):
    node tools/slots-rtp120.mjs                # калибровка + запись
    node tools/slots-rtp120.mjs --dry          # только посчитать, файл не менять
    node tools/slots-rtp120.mjs --spins 8000000 --cap 120 --window 0.4 --bet 10 --seed 2026

  Цель: RTP попадает в окно [cap − window; cap], т.е. «120% или чуть меньше».
*/
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const SPINS = Number(args.spins || 4_000_000), BET = Number(args.bet || 10), SEED = Number(args.seed || 2026);
const CAP = Number(args.cap || 120), WINDOW = Number(args.window || 0.4), AIM = CAP - WINDOW / 2, DRY = Boolean(args.dry);
const FILE = fileURLToPath(new URL('../js/slots-math.js', import.meta.url));

/* ---------- патч исходника ---------- */
function swap(src, from, to, label) {
  if (src.includes(to)) return src;                         // уже применено
  if (!src.includes(from)) throw new Error(`Не нашёл место для правки «${label}» в slots-math.js — файл изменился?`);
  return src.replace(from, () => to);
}
function patch(src, scale) {
  let s = src;
  if (!/export const LOSS_X\b/.test(s)) {
    if (!/export const JP_COEF = [^\n]*\n/.test(s)) throw new Error('Не нашёл JP_COEF для вставки LOSS_X.');
    s = s.replace(/(export const JP_COEF = [^\n]*\n)/, (m) => `${m}export const LOSS_X = 0.5; // выигрыш ≤ LOSS_X × ставки считается проигрышем (жар, множитель фриспинов, уровень празднования)\n`);
  }
  if (!/export const LINE_SCALE = [\d.]+;/.test(s)) throw new Error('Не нашёл LINE_SCALE.');
  s = s.replace(/export const LINE_SCALE = [\d.]+;/, `export const LINE_SCALE = ${scale};`);
  s = swap(s, 'res.win > 0 ? 0 : S.heat + 1', 'res.win > LOSS_X ? 0 : S.heat + 1', 'heat');
  s = swap(s, 'if (res.win > 0) fs.mult', 'if (res.win > LOSS_X) fs.mult', 'множитель фриспинов');
  s = swap(s, "x > 0 ? 'small'", "x > LOSS_X ? 'small'", 'winTier');
  return s;
}
const load = src => import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

/* ---------- симуляция ---------- */
function simulate(M, spins, seed) {
  const rng = M.mulberry32(seed), S = M.newSlotsState(), thr = M.LOSS_X * BET;
  let won = 0, base = 0, fs = 0, pick = 0, jp = 0, hits = 0, anyWin = 0, small = 0, big15 = 0;
  for (let i = 0; i < spins; i++) {
    const R = M.rollRound(rng, S, BET, {}, { paid: true });
    won += R.won; base += R.parts.base; fs += R.parts.fs; pick += R.parts.pick; jp += R.parts.jp;
    if (R.won > 0) anyWin++;
    if (R.won > thr) hits++; else if (R.won > 0) small++;
    if (R.won >= 15 * BET) big15++;
  }
  const w = spins * BET, pc = x => 100 * x / w;
  return { rtp: pc(won), base: pc(base), fs: pc(fs), pick: pc(pick), jp: pc(jp),
    hit: 100 * hits / spins, hitAny: 100 * anyWin / spins, small: 100 * small / spins, big15: 100 * big15 / spins };
}
const fmt = r => `RTP ${r.rtp.toFixed(2)}% (база ${r.base.toFixed(1)} · фриспины ${r.fs.toFixed(1)} · поляна ${r.pick.toFixed(1)} · джекпот ${r.jp.toFixed(2)}) | ` +
  `«победы» (>${0.5}×) ${r.hit.toFixed(1)}% · мелочь, считающаяся проигрышем ${r.small.toFixed(1)}% · любой выигрыш ${r.hitAny.toFixed(1)}% · ≥15× ${r.big15.toFixed(2)}%`;

/* ---------- калибровка ---------- */
const original = readFileSync(FILE, 'utf8');
const round4 = x => Math.round(x * 10000) / 10000;
const cache = new Map();
async function measure(scale, seed = SEED, spins = SPINS) {
  const key = `${scale}|${seed}|${spins}`; if (cache.has(key)) return cache.get(key);
  const M = await load(patch(original, scale)), t0 = Date.now(), r = simulate(M, spins, seed);
  console.log(`  scale ${scale.toFixed(4)} → ${fmt(r)}  [${((Date.now() - t0) / 1000).toFixed(1)} с]`);
  cache.set(key, r); return r;
}

console.log(`Калибровка: ${SPINS.toLocaleString('ru-RU')} спинов, ставка ${BET}, seed ${SEED}, цель ${AIM.toFixed(2)}% (окно ${CAP - WINDOW}–${CAP}%).`);
let s0 = 1.25, r0 = await measure(s0), s1 = round4(Math.min(4, Math.max(0.3, s0 * AIM / r0.rtp))), r1 = await measure(s1);
let best = Math.abs(r0.rtp - AIM) < Math.abs(r1.rtp - AIM) ? [s0, r0] : [s1, r1];
for (let it = 0; it < 10 && !(best[1].rtp <= CAP && best[1].rtp >= CAP - WINDOW); it++) {
  const slope = (r1.rtp - r0.rtp) / (s1 - s0);
  let s2 = Math.abs(slope) < 1e-9 ? s1 * AIM / r1.rtp : s1 + (AIM - r1.rtp) / slope;
  s2 = round4(Math.min(4, Math.max(0.3, s2)));
  if (s2 === s1 || s2 === s0) s2 = round4(s1 + (AIM > r1.rtp ? 0.0005 : -0.0005));
  const r2 = await measure(s2);
  [s0, r0, s1, r1] = [s1, r1, s2, r2];
  if (Math.abs(r2.rtp - AIM) < Math.abs(best[1].rtp - AIM)) best = [s2, r2];
}
const [scale, result] = best;
console.log(`\nВыбран LINE_SCALE = ${scale}`);
console.log(`Основной прогон: ${fmt(result)}`);
const inWindow = r => r.rtp <= CAP && r.rtp >= CAP - WINDOW;
console.log(inWindow(result) ? 'Попали в окно.' : 'Внимание: окно не достигнуто — попробуйте больше --spins или шире --window.');

console.log('\nПроверка на других seed (шум на 4M спинов ≈ ±0.4%, ориентир — среднее):');
const checks = [await measure(scale, SEED + 1), await measure(scale, SEED + 2)];
const mean = (result.rtp + checks[0].rtp + checks[1].rtp) / 3;
console.log(`Среднее RTP по трём seed: ${mean.toFixed(2)}%`);
if (mean > CAP) console.log(`Среднее выше ${CAP}% — если нужно строго не выше, запустите с меньшим --cap (например --cap ${(CAP - (mean - CAP) - 0.2).toFixed(1)}).`);

if (DRY) console.log('\n--dry: файл не изменён.');
else {
  copyFileSync(FILE, `${FILE}.bak`);
  writeFileSync(FILE, patch(original, scale));
  console.log(`\nЗаписано: js/slots-math.js (бэкап: js/slots-math.js.bak).`);
  console.log('Дальше: поправьте границы RTP/hit в tests/slots.mjs и проверку фриспинов (см. ниже в ответе).');
}
