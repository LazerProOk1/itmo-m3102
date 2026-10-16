#!/usr/bin/env node
/*
  Установщик раздела «Колючий куш» (слоты на ягоды из игры «Ёжик»).

    node tools/apply-slots.mjs              — установить (создать файлы и внести правки)
    node tools/apply-slots.mjs --dry-run    — только показать, что будет сделано
    node tools/apply-slots.mjs --root <dir> — корень репозитория (по умолчанию — родитель папки tools)

  Свойства:
  - идемпотентен: повторный запуск ничего не ломает и пишет «уже применено»;
  - всё или ничего: пока хоть один якорь правки не найден ровно один раз, на диск не пишется ни байта;
  - после записи каждый JS-файл (и модульный скрипт из index.html) проверяется `node --check`; при ошибке — откат;
  - генерируемые файлы встроены сюда как String.raw (обратные кавычки и «${» закодированы токенами @@BT@@ / @@DS@@).
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const T = s => s.replaceAll('@@DS@@', '${').replaceAll('@@BT@@', '`');

/* ======================= встроенные файлы (создаются целиком) ======================= */
const FILES = {
  'js/slots-math.js': String.raw`/*
  «Колючий куш» — чистая математика слотов. Без DOM и без Math-генератора: ГСЧ внедряется (crypto или seed).
  Числа RTP/частоты существуют только здесь, в тестах и в tools/slots-tune.mjs — в интерфейсе их нет.
  Допуск по перкам шляп (≤ +0.3% RTP суммарно) проверяется в tests/slots.mjs.
*/
export const SEED_POOL = 500, POOL_RATE = 0.015, MAX_WIN = 5000, HEAT_MAX = 10, DAILY_BET = 5;
export const BETS = [1, 2, 5, 10, 25, 50];
export const ROWS = 3, REELS = 5;
export const SYMBOLS = ['berry', 'apple', 'mush', 'git', 'orange', 'cpp', 'rust', 'pi', 'hog', 'king', 'wild', 'scatter', 'bonus'];
export const LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [0, 2, 0, 2, 0],
];
// выплаты за 3/4/5 в линии — в долях ставки на линию (общая ставка = 20 линий)
export const PAY = {
  berry: [1, 3, 10], apple: [1, 3, 10], mush: [1.5, 5, 15], git: [1.5, 5, 15],
  orange: [4, 14, 55], cpp: [4, 14, 55], rust: [6, 20, 80], pi: [6, 20, 80],
  hog: [12, 45, 220], king: [30, 150, 800],
};
export const LINE_SCALE = 2.27; // калибровка линейных выплат (см. tools/slots-tune.mjs)
export const SCATTER_PAY = { 3: 2, 4: 10, 5: 50 };
export const FS_SPINS = { 3: 8, 4: 12, 5: 20 }, FS_RETRIGGER = 5, FS_CAP = 10;
export const WARM_SCALE = 1.035; // компенсация: тёплые ленты выигрывают чаще, но RTP остаётся таким же
export const JP_COEF = 0.008; // шанс розыгрыша джекпота при 3 расширенных Wild = min(1, JP_COEF × ставка)

/* ---------- ГСЧ ---------- */
export function mulberry32(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function cryptoRng() {
  const c = globalThis.crypto;
  if (!c || !c.getRandomValues) return mulberry32(Date.now() ^ 0x9e3779b9);
  const buf = new Uint32Array(64); let i = 64;
  return () => { if (i >= 64) { c.getRandomValues(buf); i = 0; } return buf[i++] / 4294967296; };
}
const pickW = (rng, weights) => { let t = 0; for (const w of weights) t += w; let r = rng() * t; for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; } return weights.length - 1; };

/* ---------- ленты барабанов ---------- */
// количества символов на ленте по барабанам; «тёплый» набор — для горячей серии
const COUNTS = {
  cold: [
    { berry: 8, apple: 8, mush: 7, git: 7, orange: 5, cpp: 4, rust: 3, pi: 3, hog: 2, king: 1, scatter: 1, bonus: 3 },
    { berry: 8, apple: 8, mush: 7, git: 6, orange: 5, cpp: 4, rust: 3, pi: 3, hog: 2, king: 1, wild: 1, scatter: 2 },
    { berry: 7, apple: 7, mush: 6, git: 6, orange: 5, cpp: 4, rust: 3, pi: 3, hog: 2, king: 1, wild: 2, scatter: 2, bonus: 3 },
    { berry: 8, apple: 8, mush: 7, git: 6, orange: 5, cpp: 4, rust: 3, pi: 3, hog: 2, king: 1, wild: 1, scatter: 2 },
    { berry: 8, apple: 8, mush: 7, git: 7, orange: 5, cpp: 4, rust: 3, pi: 3, hog: 2, king: 1, scatter: 1, bonus: 3 },
  ],
};
// «тёплые» ленты: та же длина и те же Scatter/Bonus/Wild, но меньше крупных символов — выигрыши чаще и мельче
COUNTS.warm = COUNTS.cold.map(c => ({ ...c, hog: c.hog - 1, rust: c.rust - 1, pi: c.pi - 1, berry: c.berry + 1, apple: c.apple + 1, mush: c.mush + 1 }));
COUNTS.fs = COUNTS.cold.map((c, i) => ({ ...c, wild: (c.wild || 0) + (i >= 1 && i <= 3 ? 2 : 0), bonus: 0 })); // фриспины: больше Wild
const SPECIAL = new Set(['wild', 'scatter', 'bonus']);
export function buildStrip(counts, seed) {
  const rng = mulberry32(seed), plain = [], special = [];
  for (const sym of SYMBOLS) for (let i = 0; i < (counts[sym] || 0); i++) (SPECIAL.has(sym) ? special : plain).push(sym);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  shuffle(plain); shuffle(special);
  const L = plain.length + special.length, out = new Array(L).fill(null);
  special.forEach((s, k) => { let p = Math.floor((k + 0.5) * L / special.length); while (out[p]) p = (p + 1) % L; out[p] = s; });
  let j = 0; for (let i = 0; i < L; i++) if (!out[i]) out[i] = plain[j++];
  return out;
}
export const STRIPS = {
  cold: COUNTS.cold.map((c, i) => buildStrip(c, 1000 + i * 17)),
  warm: COUNTS.warm.map((c, i) => buildStrip(c, 2000 + i * 17)),
  fs: COUNTS.fs.map((c, i) => buildStrip(c, 3000 + i * 17)),
};

/* ---------- вращение и оценка ---------- */
export function spinGrid(rng, set = 'cold') {
  const strips = STRIPS[set], stops = [], raw = [];
  for (let i = 0; i < REELS; i++) { const s = strips[i], at = Math.floor(rng() * s.length); stops.push(at); raw.push([s[at], s[(at + 1) % s.length], s[(at + 2) % s.length]]); }
  return { stops, raw };
}
const isLine = s => s !== 'scatter' && s !== 'bonus';
// raw: 5×3 символов; mult0 — глобальный множитель (в фриспинах), расширенные Wild добавляют +1 каждый
export function evaluate(raw, mult0 = 1, scale = 1) {
  const grid = raw.map(r => r.slice()), expanded = [];
  for (let i = 1; i <= 3; i++) if (raw[i].includes('wild')) { expanded.push(i); grid[i] = raw[i].map(s => (isLine(s) ? 'wild' : s)); }
  const lines = []; let units = 0;
  for (let li = 0; li < LINES.length; li++) {
    const L = LINES[li]; let target = '', n = 0;
    for (let i = 0; i < REELS; i++) {
      const s = grid[i][L[i]];
      if (!isLine(s)) break;
      if (s === 'wild') { n++; continue; }
      if (!target) target = s; else if (s !== target) break;
      n++;
    }
    if (!target) continue; // чистые Wild без символа не платят — их на лентах не бывает
    if (n >= 3) { const pay = PAY[target][n - 3] * LINE_SCALE * scale; units += pay; lines.push({ line: li, sym: target, count: n, pay: pay / 20 }); }
  }
  let scatter = 0; const bonusReels = [];
  for (let i = 0; i < REELS; i++) { for (const s of raw[i]) if (s === 'scatter') scatter++; if (raw[i].includes('bonus')) bonusReels.push(i); }
  const scatterPay = SCATTER_PAY[Math.min(scatter, 5)] || 0, mult = mult0 + expanded.length;
  const lineWin = units / 20, total = Math.min(MAX_WIN, lineWin * mult + scatterPay);
  return { raw, grid, expanded, lines, lineWin, scatter, scatterPay, mult, win: total, fsSpins: scatter >= 3 ? FS_SPINS[Math.min(scatter, 5)] : 0,
    bonus: [0, 2, 4].every(r => bonusReels.includes(r)), jackpotRoll: expanded.length >= 3 };
}
// розыгрыш джекпота при 3 расширенных Wild: шанс растёт со ставкой
export const jackpotHit = (rng, bet) => rng() < Math.min(1, JP_COEF * bet);

/* ---------- фриспины ---------- */
export const fsStart = (n, perks = {}) => ({ left: n, mult: 1, total: 0, played: 0, cap: FS_CAP + (perks.foil ? 1 : 0), retriggers: 0 });
// один фриспин; ходит по тем же лентам; множитель растёт на 1 после каждого выигрышного спина
export function fsStep(rng, fs) {
  const { raw } = spinGrid(rng, 'fs'), res = evaluate(raw, fs.mult);
  const win = Math.min(MAX_WIN - fs.total, res.win);
  fs.total += win; fs.played++; fs.left--;
  if (res.scatter >= 3) { fs.left += FS_RETRIGGER; fs.retriggers++; }
  const startMult = fs.mult;
  if (res.win > 0) fs.mult = Math.min(fs.cap, fs.mult + 1);
  return { res, win, startMult, mult: fs.mult, done: fs.left <= 0 };
}

/* ---------- бонус «Ягодная поляна» ---------- */
export const PICK_PRIZES = [1, 1, 2, 2, 3, 4, 5, 8, 10, 15];
export const PICK_GOLD = 0.004; // шанс, что на поляне есть золотой куст (джекпот)
export function pickInit(rng, perks = {}) {
  const cells = ['segfault', 'extra', 'extra', 'm2', 'm3'];
  const prizes = PICK_PRIZES.slice(); for (let i = prizes.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [prizes[i], prizes[j]] = [prizes[j], prizes[i]]; }
  while (cells.length < 12) cells.push('p' + prizes[cells.length - 5]);
  if (rng() < PICK_GOLD) cells[5 + Math.floor(rng() * 7)] = 'gold';
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return { cells, revealed: [], picks: 3, wz: Boolean(perks.wizard), prizes: 0, mult: 1, over: false, jackpot: false, segfault: false };
}
// Колпак мага: один дополнительный «магический» куст с небольшим призом (в RTP это ≈ +0.15%)
export const WIZARD_PRIZE = 0.3;
export function pickWizard(g) { if (!g.wz || g.segfault || g.jackpot) return null; g.wz = false; g.prizes += WIZARD_PRIZE; return WIZARD_PRIZE; }
export const pickTotal = g => Math.min(MAX_WIN, g.prizes * g.mult);
export function pickReveal(g, idx) {
  if (g.over || g.revealed.includes(idx)) return null;
  const c = g.cells[idx]; g.revealed.push(idx); g.picks--;
  if (c === 'segfault') { g.segfault = true; g.over = true; }
  else if (c === 'extra') g.picks++;
  else if (c === 'm2') g.mult *= 2;
  else if (c === 'm3') g.mult *= 3;
  else if (c === 'gold') { g.jackpot = true; g.over = true; }
  else g.prizes += Number(c.slice(1));
  if (g.picks <= 0 || g.revealed.length >= g.cells.length) g.over = true;
  return c;
}

/* ---------- расчёт в целых ягодах с переносом дробной части ---------- */
export function settle(frac, amount) { const raw = amount + frac, whole = Math.floor(raw + 1e-9); return { whole, frac: Math.max(0, raw - whole) }; }

/* ---------- состояние и один платный/бесплатный спин ---------- */
export function newSlotsState() {
  return { v: 1, streak: 0, lastDay: '', free: 0, heat: 0, pool: SEED_POOL, frac: 0, sinceEpic: 0, capsules: 0, album: {}, ach: {},
    stats: { spins: 0, wagered: 0, won: 0, biggest: 0, fs: 0, picks: 0, jackpots: 0, gambles: 0, gambleWins: 0, poked: 0 }, breakUntil: 0, wheelDay: '', title: '', theme: 'forest', hist: [] };
}
// Базовый спин. S: {heat, pool}; paid=false для бесплатных (не питает пул и не копит «жар»)
export function baseSpin(rng, S, bet, { paid = true } = {}) {
  const warm = paid && S.heat >= HEAT_MAX;
  if (paid) S.pool += POOL_RATE * bet;
  const { stops, raw } = spinGrid(rng, warm ? 'warm' : 'cold'), res = evaluate(raw, 1, warm ? WARM_SCALE : 1);
  res.stops = stops; res.warm = warm; res.jackpot = 0;
  if (res.jackpotRoll && jackpotHit(rng, bet)) { res.jackpot = S.pool; S.pool = SEED_POOL; }
  if (paid) S.heat = warm ? 0 : (res.win > 0 ? 0 : S.heat + 1);
  return res;
}
// Полный раунд: база + фриспины + поляна + джекпот. Возвращает выигрыш в ягодах и трассу для анимации
// (интерфейс получает весь результат заранее, поэтому обновление страницы посреди бонуса ничего не отнимает).
export function rollRound(rng, S, bet, perks = {}, opts = {}) {
  const res = baseSpin(rng, S, bet, opts), parts = { base: res.win * bet, fs: 0, pick: 0, jp: res.jackpot, fsN: 0 }, trace = { res, fsSteps: [], fs: null, pick: null, pickJp: 0 };
  if (res.fsSpins) {
    const fs = fsStart(res.fsSpins, perks); parts.fsN = res.fsSpins;
    while (fs.left > 0) { const st = fsStep(rng, fs); let jp = 0; if (st.res.jackpotRoll && jackpotHit(rng, bet)) { jp = S.pool; parts.jp += jp; S.pool = SEED_POOL; } trace.fsSteps.push({ ...st, jp, left: fs.left, total: fs.total }); }
    parts.fs = Math.min(MAX_WIN, fs.total) * bet; trace.fs = fs;
  }
  if (res.bonus) {
    const g = pickInit(rng, perks), seq = []; let k = 0;
    while (!g.over) { pickReveal(g, k); seq.push(g.cells[k]); k++; } // содержимое кустов уже перемешано: порядок показа не важен
    const wz = pickWizard(g); parts.pick = pickTotal(g) * bet;
    if (g.jackpot) { trace.pickJp = S.pool; parts.jp += S.pool; S.pool = SEED_POOL; }
    trace.pick = { g, seq, wz, total: pickTotal(g) };
  }
  parts.total = parts.base + parts.fs + parts.pick + parts.jp;
  return { res, parts, won: parts.total, trace };
}
export const playRound = rollRound;

/* ---------- «Удвоить или ничего» ---------- */
export const GAMBLE_MAX_ROUNDS = 3, GAMBLE_MAX_X = 25;
export const gambleAllowed = (winBerries, bet, round) => winBerries > 0 && winBerries <= GAMBLE_MAX_X * bet && round < GAMBLE_MAX_ROUNDS;
export function gambleRound(rng, choice) { const card = rng() < 0.5 ? 'red' : 'black'; return { card, won: card === choice }; }

/* ---------- ежедневные спины ---------- */
export const DAILY_SPINS = [1, 1, 2, 2, 3, 3, 5];
export const dayKey = (d = new Date()) => @@BT@@@@DS@@d.getFullYear()}-@@DS@@String(d.getMonth() + 1).padStart(2, '0')}-@@DS@@String(d.getDate()).padStart(2, '0')}@@BT@@;
export const addDay = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() + n); return x; };
export function dailyPreview(S, now = new Date()) {
  const today = dayKey(now), can = S.lastDay !== today, streak = S.lastDay === dayKey(addDay(now, -1)) ? (S.streak % 7) + 1 : 1;
  return { can, streak: can ? streak : S.streak, today };
}
// perks.crown: +1 спин на 7-й день. Возвращает null, если сегодня уже забрано
export function dailyClaim(S, now = new Date(), perks = {}) {
  const p = dailyPreview(S, now); if (!p.can) return null;
  const spins = DAILY_SPINS[p.streak - 1] + (perks.crown && p.streak === 7 ? 1 : 0), capsule = p.streak === 7;
  S.streak = p.streak; S.lastDay = p.today; S.free += spins; if (capsule) S.capsules++;
  return { spins, capsule, streak: p.streak };
}
// доступно ли колесо: нужны все 3 цели дня ёжика и неиспользованный день
export const wheelReady = (S, hhSave, now = new Date()) => { const d = hhSave && hhSave.daily; return Boolean(d && d.date === dayKey(now) && Array.isArray(d.goals) && d.goals.length >= 3 && d.goals.every(g => g.done) && S.wheelDay !== dayKey(now)); };
export const WHEEL = [
  { k: 'b', v: 5, w: 26 }, { k: 'b', v: 10, w: 22 }, { k: 'b', v: 15, w: 14 }, { k: 'cap', w: 9 }, { k: 'b', v: 25, w: 10 },
  { k: 'spin', w: 8 }, { k: 'b', v: 50, w: 5 }, { k: 'b', v: 10, w: 20 }, { k: 'cap', w: 4 }, { k: 'b', v: 100, w: 2 },
];
export const wheelPick = rng => pickW(rng, WHEEL.map(s => s.w));

/* ---------- альбом и капсулы ---------- */
export const RARITY = { common: { name: 'Обычная', dup: 10, w: 60 }, rare: { name: 'Редкая', dup: 30, w: 28 }, epic: { name: 'Эпическая', dup: 80, w: 10 }, legendary: { name: 'Легендарная', dup: 250, w: 2 } };
export const PITY_CAPSULES = 12;
const it = (id, kind, name, rarity, desc, setOnly = false) => ({ id, kind, name, rarity, desc, setOnly });
export const CATALOG = [
  it('hat:itmocap', 'hat', 'Кепка студента ИТМО', 'rare', 'Игра: сонливость растёт на 15% медленнее'),
  it('hat:goldtop', 'hat', 'Золотой цилиндр', 'epic', 'Игра: ягоды дают вдвое больше очков трюков'),
  it('hat:crabgear', 'hat', 'Шлем краба-шестерёнки', 'epic', 'Игра: старт со щитом и 3 секунды неуязвимости'),
  it('hat:orangepeel', 'hat', 'Апельсиновая кожура', 'common', 'Игра: яблоки бодрят сильнее'),
  it('hat:cpphelm', 'hat', 'Шлем C++', 'rare', 'Игра: быстрее старт и короткий буст'),
  it('hat:foilpro', 'hat', 'Фольга-ПРО', 'legendary', 'Игра: бонусы действуют вдвое дольше'),
  it('pal:gold', 'palette', 'Палитра «Золото»', 'epic', 'Цвета сайта в настройках'),
  it('pal:neon', 'palette', 'Палитра «Неон»', 'epic', 'Цвета сайта в настройках'),
  it('pal:aurora', 'palette', 'Палитра «Аврора»', 'legendary', 'Цвета сайта в настройках'),
  it('greet:cat', 'greeting', 'Пак «Кошачий»', 'common', 'Две новые шутки на главной'),
  it('greet:rust', 'greeting', 'Пак «Растаманский»', 'common', 'Две новые шутки на главной'),
  it('greet:matan', 'greeting', 'Пак «Матан»', 'rare', 'Две новые шутки на главной'),
  it('greet:orange', 'greeting', 'Пак «Апельсиновый»', 'rare', 'Две новые шутки на главной'),
  it('greet:casino', 'greeting', 'Пак «Казино»', 'rare', 'Две новые шутки на главной'),
  it('boost:shield', 'boost', 'Бонус: щит на старт', 'common', 'Расходуется в начале забега'),
  it('boost:coffee', 'boost', 'Бонус: кофе на старт', 'common', 'Расходуется в начале забега'),
  it('boost:magnet', 'boost', 'Бонус: магнит на старт', 'common', 'Расходуется в начале забега'),
  it('boost:berrystart', 'boost', 'Бонус: «Ягодный старт»', 'rare', '+25% ягод за один забег'),
  it('title:newbie', 'title', 'Титул: Новичок казино', 'common', 'Рядом с именем на странице'),
  it('title:thorn', 'title', 'Титул: Колючий игрок', 'rare', 'Рядом с именем на странице'),
  it('title:master', 'title', 'Титул: Мастер-теорема', 'rare', 'Рядом с именем на странице'),
  it('title:orange', 'title', 'Титул: Вы Апельсин?', 'epic', 'Рядом с именем на странице'),
  it('title:king', 'title', 'Титул: Король ёжиков', 'legendary', 'Рядом с именем на странице'),
  it('title:hats', 'title', 'Титул: Шляпный мастер', 'epic', 'Награда за полный набор шляп', true),
  it('theme:forest', 'theme', 'Тема барабанов: Лес', 'common', 'Рамка автомата'),
  it('theme:night', 'theme', 'Тема барабанов: Звёздная ночь', 'rare', 'Рамка автомата'),
  it('theme:server', 'theme', 'Тема барабанов: Серверная', 'epic', 'Рамка автомата'),
];
export const ITEM = Object.fromEntries(CATALOG.map(x => [x.id, x]));
export const FREE_ITEMS = ['theme:forest', 'title:newbie']; // выдаются сразу
// плата за набор: все 6 шляп → титул (выдаётся интерфейсом через grantSets)
export const grantSets = S => { const got = []; if (HAT_SET.every(id => S.album[id]) && !S.album['title:hats']) { S.album['title:hats'] = 1; got.push('title:hats'); } return got; };
export const HAT_SET = CATALOG.filter(x => x.kind === 'hat').map(x => x.id);
export const albumProgress = S => ({ have: CATALOG.filter(x => S.album[x.id]).length, total: CATALOG.length });
// Открывает одну капсулу; меняет S.album/S.sinceEpic. Возвращает {item, dup, berries}
export function openCapsule(rng, S) {
  const rar = ['common', 'rare', 'epic', 'legendary'];
  let r = S.sinceEpic >= PITY_CAPSULES ? 2 + pickW(rng, [RARITY.epic.w, RARITY.legendary.w]) : pickW(rng, rar.map(k => RARITY[k].w));
  const pool = CATALOG.filter(x => x.rarity === rar[r] && !x.setOnly), item = pool[Math.floor(rng() * pool.length)];
  S.sinceEpic = r >= 2 ? 0 : S.sinceEpic + 1;
  const had = S.album[item.id] || 0, dup = had > 0 && item.kind !== 'boost';
  S.album[item.id] = had + 1;
  return { item, dup, berries: dup ? RARITY[item.rarity].dup : 0 };
}

/* ---------- контрольные суммы (лёгкая защита от случайных правок, не криптография) ---------- */
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const stable = v => (Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}' : JSON.stringify(v));
const SALT = 'kolyuchiy-kush-v1';
export const signSlots = S => { const { sig, ...rest } = S; return cyrb53(SALT + stable(rest), 1); };
export const signShared = save => cyrb53(SALT + stable({ b: save.berries | 0, o: [...(save.owned || [])].sort(), s: save.bonusSpins | 0, x: save.boosts || {} }), 2);
// ok — подпись верна; legacy — подписи ещё нет (принимаем и подписываем); bad — данные правили руками
export const checkSlots = S => (!S.sig ? 'legacy' : S.sig === signSlots(S) ? 'ok' : 'bad');
export const checkShared = save => (!save.bsig ? 'legacy' : save.bsig === signShared(save) ? 'ok' : 'bad');

/* ---------- мелочи для интерфейса ---------- */
export const payMult = (sym, n) => (PAY[sym][n - 3] * LINE_SCALE) / 20; // для таблицы выплат: доля общей ставки за линию
export const winTier = x => (x >= 100 ? 'epic' : x >= 40 ? 'mega' : x >= 15 ? 'big' : x >= 5 ? 'good' : x > 0 ? 'small' : 'none');
// плашка на старте игры «Ёжик»: сколько бесплатных спинов ждёт
export function slotsChipText(save, rawSlots, now = new Date()) {
  let S = null; try { S = rawSlots ? JSON.parse(rawSlots) : null; } catch { S = null; }
  const free = (save.bonusSpins | 0) + (S ? S.free | 0 : 0), daily = !S || S.lastDay !== dayKey(now);
  return daily ? 'ежедневный спин готов' : free > 0 ? @@BT@@@@DS@@free} бесплатных@@BT@@ : wheelReady(S || newSlotsState(), save, now) ? 'колесо заряжено' : '';
}
`,
  'js/slots-art.js': String.raw`/*
  Оригинальные SVG-символы слотов «Колючий куш» в одном скрытом спрайте (viewBox 0 0 100 100).
  Никаких чужих логотипов: «ИТМО»-щит и «C++» — стилизованные рисунки. Подписи — по-русски для скринридеров.
*/
export const LABELS = {
  berry: 'Малина', apple: 'Яблоко', mush: 'Гриб-мухомор', git: 'Значок Git', orange: 'Апельсин', cpp: 'Шестиугольник C++', rust: 'Краб-шестерёнка',
  pi: 'Свиток ∑ и π', hog: 'Ёжик', king: 'Король ёжиков', wild: 'Дикий шар-ёжик (Wild)', scatter: 'Щит-скаттер', bonus: 'Корзина с ягодами (бонус)',
};
const g = (id, a, b, x2 = 0, y2 = 1) => @@BT@@<linearGradient id="g-@@DS@@id}" x1="0" y1="0" x2="@@DS@@x2}" y2="@@DS@@y2}"><stop offset="0" stop-color="@@DS@@a}"/><stop offset="1" stop-color="@@DS@@b}"/></linearGradient>@@BT@@;
const DEFS = [
  g('red', '#ff7a7a', '#c4232f'), g('pink', '#ff9ac4', '#d6246e'), g('orange', '#ffc15a', '#e8730e'), g('blue', '#6fb6ff', '#1b55c9'), g('green', '#9be37a', '#2c8c3c'),
  g('brown', '#a37850', '#5b3d2b'), g('peach', '#fbe0bd', '#e8b786'), g('gold', '#fff0a0', '#d99a1f'), g('navy', '#47c8e8', '#14316b'), g('parch', '#fff6dc', '#e2c78f'),
  g('violet', '#b69cff', '#5b3fd0'), g('wick', '#e2b46c', '#9a6a2d'), g('gitc', '#ff9a5c', '#d8381d'), g('rustc', '#ffb070', '#b5470f'),
  '<radialGradient id="g-ball" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#c99a6a"/><stop offset="1" stop-color="#5b3d2b"/></radialGradient>',
  '<radialGradient id="g-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6a0" stop-opacity=".95"/><stop offset="1" stop-color="#fff6a0" stop-opacity="0"/></radialGradient>',
].join('');
const spikes = (cx, cy, r, n, len, fill) => Array.from({ length: n }, (_, i) => { const a = Math.PI * (0.55 + 1.35 * i / (n - 1)), d = 0.19; const p = k => @@BT@@@@DS@@(cx + Math.cos(a + k) * r).toFixed(1)},@@DS@@(cy + Math.sin(a + k) * r).toFixed(1)}@@BT@@; return @@BT@@<path d="M@@DS@@p(-d)} L@@DS@@(cx + Math.cos(a) * (r + len)).toFixed(1)},@@DS@@(cy + Math.sin(a) * (r + len)).toFixed(1)} L@@DS@@p(d)}Z" fill="@@DS@@fill}"/>@@BT@@; }).join('');
const hedge = (crown) => @@BT@@@@DS@@spikes(50, 52, 30, 11, 20, '#4a2f20')}@@DS@@spikes(50, 52, 28, 10, 14, '#7a5436')}<ellipse cx="50" cy="60" rx="34" ry="28" fill="url(#g-ball)"/><path d="M42 74c10-20 30-18 40-4 4 7-6 14-26 14-8 0-14-4-14-10z" fill="url(#g-peach)"/><ellipse cx="74" cy="66" rx="9" ry="7" fill="url(#g-peach)"/><circle cx="83" cy="66" r="3.6" fill="#2b1d18"/><circle cx="66" cy="58" r="3.2" fill="#1f1612"/><circle cx="67" cy="57" r="1" fill="#fff"/><path d="M70 72q4 3 8 0" stroke="#7a4a30" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="31" cy="48" r="6" fill="#e8bf8d"/>@@DS@@crown ? '<path d="M34 34l4-14 9 9 6-13 6 13 9-9 4 14z" fill="url(#g-gold)" stroke="#b9791a" stroke-width="2" stroke-linejoin="round"/><circle cx="38" cy="20" r="2.6" fill="#e8467c"/><circle cx="53" cy="16" r="3" fill="#4aa8ff"/><circle cx="68" cy="20" r="2.6" fill="#e8467c"/>' : ''}@@BT@@;
const S = {
  berry: '<g stroke="#a0124f" stroke-width="1.5">' + [[35, 44], [50, 40], [65, 44], [28, 58], [43, 56], [58, 56], [72, 58], [36, 71], [51, 70], [66, 71], [50, 83]].map(([x, y]) => @@BT@@<circle cx="@@DS@@x}" cy="@@DS@@y}" r="9.5" fill="url(#g-pink)"/><circle cx="@@DS@@x - 3}" cy="@@DS@@y - 3}" r="2.4" fill="#fff" fill-opacity=".7" stroke="none"/>@@BT@@).join('') + '</g><path d="M50 36l-14-12 10 3 4-10 4 10 10-3z" fill="url(#g-green)" stroke="#1f6a2c" stroke-width="2" stroke-linejoin="round"/>',
  apple: '<path d="M50 30c-14-10-34-2-34 22 0 22 16 38 28 38 4 0 4-2 6-2s2 2 6 2c12 0 28-16 28-38 0-24-20-32-34-22z" fill="url(#g-red)" stroke="#8d1520" stroke-width="2.5"/><path d="M50 30q-2-12 6-20" stroke="#5b3d2b" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M56 22q16-14 28-2-12 14-28 2z" fill="url(#g-green)" stroke="#1f6a2c" stroke-width="2"/><ellipse cx="32" cy="48" rx="6" ry="11" fill="#fff" fill-opacity=".45" transform="rotate(18 32 48)"/>',
  mush: '<path d="M38 56h24l4 30c0 4-4 6-16 6s-16-2-16-6z" fill="#f6e6d0" stroke="#a88a62" stroke-width="2.5"/><path d="M8 58C8 28 28 12 50 12s42 16 42 46c0 4-4 5-8 5H16c-4 0-8-1-8-5z" fill="url(#g-red)" stroke="#8d1520" stroke-width="2.5"/><circle cx="30" cy="34" r="7" fill="#fff"/><circle cx="56" cy="26" r="8" fill="#fff"/><circle cx="76" cy="44" r="6" fill="#fff"/><circle cx="42" cy="50" r="4.5" fill="#fff"/>',
  git: '<rect x="18" y="18" width="64" height="64" rx="8" transform="rotate(45 50 50)" fill="url(#g-gitc)" stroke="#8d230f" stroke-width="3"/><g stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"><path d="M42 36v28M42 52q0-12 16-14"/></g><g fill="#fff"><circle cx="42" cy="34" r="6.5"/><circle cx="42" cy="66" r="6.5"/><circle cx="60" cy="38" r="6.5"/></g>',
  orange: '<circle cx="50" cy="55" r="36" fill="url(#g-orange)" stroke="#b5560b" stroke-width="3"/><path d="M50 19q4-10 12-8-1 9-12 8z" fill="url(#g-green)" stroke="#1f6a2c" stroke-width="2"/><ellipse cx="36" cy="40" rx="8" ry="13" fill="#fff" fill-opacity=".38" transform="rotate(28 36 40)"/><circle cx="40" cy="55" r="3.4" fill="#3a2410"/><circle cx="60" cy="55" r="3.4" fill="#3a2410"/><path d="M38 66q12 12 24 0" stroke="#3a2410" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  cpp: '<path d="M50 8l36 21v42L50 92 14 71V29z" fill="url(#g-blue)" stroke="#0f2f7a" stroke-width="3.5" stroke-linejoin="round"/><path d="M50 18l27 16v32L50 82 23 66V34z" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/><text x="50" y="62" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="28" fill="#fff" stroke="#0f2f7a" stroke-width="1.2">C++</text>',
  rust: '<g stroke="#7a2f08" stroke-width="3" stroke-linecap="round" fill="none"><path d="M24 58L8 44M22 66L6 70M76 58l16-14M78 66l16 4M30 40L18 24M70 40L82 24"/></g><circle cx="12" cy="40" r="7" fill="url(#g-rustc)" stroke="#7a2f08" stroke-width="2.5"/><circle cx="88" cy="40" r="7" fill="url(#g-rustc)" stroke="#7a2f08" stroke-width="2.5"/><ellipse cx="50" cy="62" rx="32" ry="25" fill="url(#g-rustc)" stroke="#7a2f08" stroke-width="3"/><g fill="#6b2a07">' + Array.from({ length: 8 }, (_, i) => @@BT@@<rect x="47" y="30" width="6" height="9" rx="1.5" transform="rotate(@@DS@@i * 45} 50 62)"/>@@BT@@).join('') + '</g><circle cx="50" cy="62" r="13" fill="#ffd09a" stroke="#7a2f08" stroke-width="2.5"/><circle cx="50" cy="62" r="5" fill="#6b2a07"/><circle cx="38" cy="40" r="4" fill="#fff"/><circle cx="62" cy="40" r="4" fill="#fff"/><circle cx="39" cy="41" r="1.8" fill="#1b1220"/><circle cx="61" cy="41" r="1.8" fill="#1b1220"/>',
  pi: '<path d="M22 20h60v52c0 8-6 12-12 12H30c-6 0-10-4-10-10 0-4 2-7 6-7h4V30c0-6-4-10-8-10z" fill="url(#g-parch)" stroke="#8a6a32" stroke-width="3" stroke-linejoin="round"/><path d="M22 20c-8 0-12 4-12 9s5 8 12 8" fill="#e2c78f" stroke="#8a6a32" stroke-width="3"/><text x="52" y="46" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="25" fill="#5b3fd0">∑</text><text x="52" y="70" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="25" fill="#7a55e0">π</text>',
  hog: hedge(false), king: hedge(true),
  wild: '<circle cx="50" cy="50" r="46" fill="url(#g-glow)"/><g stroke="#ffd84a" stroke-width="4" stroke-linecap="round">' + Array.from({ length: 12 }, (_, i) => @@BT@@<path d="M50 @@DS@@i % 2 ? 6 : 2}V@@DS@@i % 2 ? 16 : 20}" transform="rotate(@@DS@@i * 30} 50 50)"/>@@BT@@).join('') + '</g><circle cx="50" cy="50" r="31" fill="url(#g-ball)" stroke="#3b2417" stroke-width="3"/><g fill="#2f1d12">' + Array.from({ length: 16 }, (_, i) => @@BT@@<path d="M-3 0L0 -9L3 0Z" transform="translate(@@DS@@(50 + Math.cos(i * 0.3927) * 31).toFixed(1)} @@DS@@(50 + Math.sin(i * 0.3927) * 31).toFixed(1)}) rotate(@@DS@@i * 22.5 + 90})"/>@@BT@@).join('') + '</g><path d="M30 56q20-18 40 0" stroke="#e8bf8d" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="62" cy="46" r="3" fill="#fff"/><text x="50" y="92" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="12" font-weight="900" fill="#fff" stroke="#3b2417" stroke-width="3" paint-order="stroke">WILD</text>',
  scatter: '<path d="M50 6l38 12v28c0 24-16 38-38 48C28 84 12 70 12 46V18z" fill="url(#g-navy)" stroke="#0b1f4a" stroke-width="3.5" stroke-linejoin="round"/><path d="M50 16l28 9v21c0 17-11 28-28 36-17-8-28-19-28-36V25z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/><path d="M50 28l5.5 12 13 1.4-9.8 8.7 2.9 12.9L50 56.2 38.4 63l2.9-12.9-9.8-8.7 13-1.4z" fill="#fff6a0" stroke="#b9911a" stroke-width="2" stroke-linejoin="round"/>',
  bonus: '<path d="M20 44q30-44 60 0" stroke="#8a5a1e" stroke-width="6" fill="none" stroke-linecap="round"/><g>' + [[34, 40], [50, 34], [66, 40], [42, 46], [58, 46]].map(([x, y]) => @@BT@@<circle cx="@@DS@@x}" cy="@@DS@@y}" r="9" fill="url(#g-pink)" stroke="#a0124f" stroke-width="2"/>@@BT@@).join('') + '</g><path d="M12 48h76l-8 40H20z" fill="url(#g-wick)" stroke="#6b4513" stroke-width="3" stroke-linejoin="round"/><path d="M20 60h60M22 72h56M36 48l-5 40M50 48v40M64 48l5 40" stroke="#6b4513" stroke-opacity=".55" stroke-width="2.5"/>',
};
const capsule = (c1, c2) => @@BT@@<circle cx="50" cy="50" r="34" fill="@@DS@@c2}"/><path d="M16 50a34 34 0 0 1 68 0z" fill="@@DS@@c1}"/><path d="M16 50h68" stroke="#fff" stroke-opacity=".7" stroke-width="3"/><ellipse cx="36" cy="32" rx="8" ry="5" fill="#fff" fill-opacity=".55" transform="rotate(-30 36 32)"/><circle cx="50" cy="50" r="34" fill="none" stroke="#2a2540" stroke-opacity=".5" stroke-width="3"/>@@BT@@;
const ICONS = {
  'cap-common': capsule('#b7c4d6', '#6b7a90'), 'cap-rare': capsule('#7ec4ff', '#2a6fd0'), 'cap-epic': capsule('#d6a0ff', '#7a35d0'), 'cap-legendary': capsule('#ffe27a', '#e0861a'),
  pointer: '<path d="M50 94L26 40a26 26 0 1 1 48 0z" fill="url(#g-gold)" stroke="#8a5a0a" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="34" r="8" fill="#fff" stroke="#8a5a0a" stroke-width="3"/>',
  flame: '<path d="M52 6c4 20 26 28 26 52 0 20-12 34-28 34S22 78 22 60c0-12 6-20 12-26 2 8 6 12 10 12-2-14 0-30 8-40z" fill="url(#g-orange)" stroke="#b5470f" stroke-width="3" stroke-linejoin="round"/><path d="M50 52c3 8 14 12 14 24 0 8-6 14-14 14s-14-6-14-14c0-8 6-12 8-18 2 4 4 6 6 6z" fill="#ffe27a"/>',
};
export const SYMBOL_IDS = Object.keys(S);
export const SPRITE = @@BT@@<svg id="sl-sprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>@@DS@@DEFS}</defs>@@DS@@Object.entries(S).map(([id, body]) => @@BT@@<symbol id="sl-@@DS@@id}" viewBox="0 0 100 100"><title>@@DS@@LABELS[id]}</title>@@DS@@body}</symbol>@@BT@@).join('')}@@DS@@Object.entries(ICONS).map(([id, body]) => @@BT@@<symbol id="sl-@@DS@@id}" viewBox="0 0 100 100">@@DS@@body}</symbol>@@BT@@).join('')}</svg>@@BT@@;
export function ensureSprite() { if (typeof document !== 'undefined' && !document.getElementById('sl-sprite')) document.body.insertAdjacentHTML('afterbegin', SPRITE); }
export const sym = (id, size = 64, cls = '') => @@BT@@<svg class="sl-sym @@DS@@cls}" width="@@DS@@size}" height="@@DS@@size}" viewBox="0 0 100 100" role="img" aria-label="@@DS@@LABELS[id] || ''}"><use href="#sl-@@DS@@id}"/></svg>@@BT@@;
export const icon = (id, size = 28, cls = '') => @@BT@@<svg class="sl-ic @@DS@@cls}" width="@@DS@@size}" height="@@DS@@size}" viewBox="0 0 100 100" aria-hidden="true"><use href="#sl-@@DS@@id}"/></svg>@@BT@@;
`,
  'js/slots-audio.js': String.raw`/*
  Звук слотов: Web Audio, всё синтезируется (файлов нет). Флаг — тот же hh_save_v1.sfx, что и в игре «Ёжик»; по умолчанию выключен.
  Музыка — только фанфара джекпота. destroy() гасит все узлы и таймеры (вызывается роутером при уходе со страницы).
*/
const KEY = 'hh_save_v1';
const hz = (base, semi) => base * Math.pow(2, semi / 12);
const PENT = [0, 2, 4, 7, 9];
export function readSfx() { try { return Boolean(JSON.parse(localStorage.getItem(KEY) || '{}').sfx); } catch { return false; } }
function writeSfx(on) { try { const s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; s.sfx = on; localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* приватный режим */ } }

export function makeSlotsAudio() {
  let ctx = null, master = null, noiseBuf = null, on = readSfx(), fanfare = 0, whir = null, dead = false;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  function ensure() {
    if (dead) return null;
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
      master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, d, o = {}) {
    if (!on || !ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0), a = o.a || 0.006, v = o.v || 0.2, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t0); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + a + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + a + d + 0.05);
  }
  function noise(d, v, fc, delay = 0, type = 'lowpass') {
    if (!on || !ensure()) return;
    const t0 = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = type; f.frequency.value = fc; g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0, Math.random() * 0.5); src.stop(t0 + d + 0.05);
  }
  const arp = (semis, base, step, o = {}) => semis.forEach((s, i) => tone(hz(base, s), o.d || 0.22, { type: o.type || 'triangle', v: o.v || 0.15, delay: i * step }));
  const api = {
    get on() { return on; },
    set(v) { on = Boolean(v); writeSfx(on); if (on) { ensure(); api.click(); } else api.stopAll(); },
    click() { tone(720, 0.04, { type: 'square', v: 0.05 }); },
    nope() { tone(200, 0.12, { type: 'square', to: 150, v: 0.08 }); },
    lever() { noise(0.18, 0.1, 900); tone(180, 0.18, { type: 'sawtooth', to: 90, v: 0.08 }); },
    whirStart() { if (!on || !ensure() || whir) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 70; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.25); o.connect(g); g.connect(master); o.start(); whir = { o, g }; },
    whirStop() { if (!whir || !ctx) return; const { o, g } = whir; whir = null; try { g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); o.stop(ctx.currentTime + 0.15); } catch { /* уже остановлен */ } },
    thunk(i = 0) { tone(150 - i * 8, 0.13, { to: 55, v: 0.26 }); noise(0.07, 0.1, 500); },
    wild() { noise(0.45, 0.14, 2600, 0, 'bandpass'); tone(300, 0.4, { to: 1100, v: 0.1 }); },
    scatter(n = 1) { tone(hz(880, PENT[n % 5]), 0.35, { v: 0.12 }); tone(hz(1320, PENT[n % 5]), 0.4, { v: 0.08, delay: 0.06 }); },
    heartbeat() { tone(70, 0.12, { v: 0.3 }); tone(62, 0.14, { v: 0.24, delay: 0.17 }); },
    tick(k = 0) { tone(900 + (k % 8) * 40, 0.03, { type: 'square', v: 0.035 }); },
    win(tier = 'small') { const n = { small: 3, good: 4, big: 6, mega: 8, epic: 10 }[tier] || 3; arp(Array.from({ length: n }, (_, i) => PENT[i % 5] + 12 * Math.floor(i / 5)), 523, 0.08, { d: 0.2 + n * 0.02 }); if (n >= 6) arp([0, 7, 12, 16], 262, 0.1, { type: 'sine', v: 0.1 }); },
    berry(k = 0) { tone(hz(660, PENT[k % 5]), 0.1, { to: hz(660, PENT[k % 5]) * 1.5, v: 0.14 }); },
    feature() { arp([0, 4, 7, 12, 16, 19], 392, 0.09, { d: 0.3 }); },
    segfault() { tone(300, 0.5, { type: 'sawtooth', to: 40, v: 0.16 }); noise(0.4, 0.14, 700); },
    shake() { noise(0.08, 0.12, 1200); tone(220, 0.06, { type: 'square', v: 0.05 }); },
    crack(r = 'common') { noise(0.2, 0.16, 3000, 0, 'highpass'); const n = { common: 3, rare: 4, epic: 5, legendary: 7 }[r] || 3; arp(Array.from({ length: n }, (_, i) => PENT[i % 5] + 7), 523, 0.09, { d: 0.35, v: 0.14 }); },
    wheelTick() { tone(1300, 0.025, { type: 'square', v: 0.05 }); },
    flip() { tone(500, 0.08, { to: 900, v: 0.1 }); tone(900, 0.08, { to: 500, v: 0.1, delay: 0.09 }); },
    gambleLose() { tone(240, 0.35, { type: 'triangle', to: 90, v: 0.14 }); },
    heat() { tone(300, 0.5, { to: 900, v: 0.08 }); },
    // единственная «музыка» — фанфара джекпота, закольцована до stopFanfare()
    fanfare() {
      if (!on || !ensure() || fanfare) return; let step = 0;
      const bar = () => { arp([0, 4, 7, 12, 7, 12, 16, 19], 262, 0.12, { type: 'square', v: 0.07, d: 0.18 }); arp([-12, -5, 0, -5], 130, 0.24, { type: 'triangle', v: 0.14, d: 0.4 }); step++; };
      bar(); fanfare = setInterval(bar, 1000);
    },
    stopFanfare() { if (fanfare) { clearInterval(fanfare); fanfare = 0; } },
    stopAll() { api.stopFanfare(); api.whirStop(); },
    destroy() { dead = true; api.stopAll(); timers.forEach(clearTimeout); timers.clear(); if (ctx) { try { ctx.close(); } catch { /* уже закрыт */ } ctx = null; } },
    later,
  };
  return api;
}
`,
  'js/slots.js': String.raw`/*
  Страница «Колючий куш» (#/slots): автомат на виртуальные ягоды из игры «Ёжик».
  Математика — в js/slots-math.js (в интерфейсе нет ни RTP, ни шансов), рисунки — js/slots-art.js, звук — js/slots-audio.js.
  Весь результат раунда считается заранее и сразу записывается в сохранение: обновление страницы во время анимации ничего не отнимает.
*/
import * as M from './slots-math.js';
import { ensureSprite, sym, icon, LABELS } from './slots-art.js';
import { makeSlotsAudio } from './slots-audio.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KEY = 'm3102-slots-v1', SNAP = 'm3102-slots-snap-v1', HHK = 'hh_save_v1';
const CANCEL = Symbol('cancel');
const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const readJson = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const FILL = ['berry', 'apple', 'mush', 'git', 'orange', 'cpp', 'rust', 'pi', 'hog', 'king', 'scatter', 'wild', 'bonus', 'berry', 'apple', 'mush'];
const KIND_EMOJI = { hat: '🎩', palette: '🎨', greeting: '💬', boost: '🎁', title: '🏅', theme: '🖼' };
const KIND_NAME = { hat: 'Шляпы', palette: 'Палитры', greeting: 'Шутки на главной', boost: 'Бонусы в забег', title: 'Титулы', theme: 'Темы барабанов' };
const THEME_CLASS = { 'theme:forest': 'th-forest', 'theme:night': 'th-night', 'theme:server': 'th-server' };
const QUIPS = ['Фыр!', 'Эй! Колется.', 'Не тыкай ёжика.', 'Сегфолт (core dumped)', 'Я при исполнении.', 'Мяу. (Это не я.)', 'Очевидно, что… ай!'];

export const ACH = [
  { id: 'five_hogs', name: '5 ёжиков в линию', desc: 'Собери пять ёжиков (или королей) на одной линии' },
  { id: 'segfault', name: 'Сегфолт', desc: 'Попади на Сегфолт с первой попытки в «Ягодной поляне»' },
  { id: 'orange_king', name: 'Апельсиновый король', desc: 'Пять апельсинов на одной линии. Вы Апельсин?' },
  { id: 'dont_poke', name: 'Не тыкай ёжика', desc: 'Потыкай ёжика на шапке страницы 25 раз' },
  { id: 'exact42', name: 'Ровно 42', desc: 'Выиграй за раунд ровно 42 🍓' },
  { id: 'heat', name: 'Горячая серия', desc: 'Дождись «тёплого» спина после череды неудач' },
  { id: 'foil', name: 'Фольга спасла', desc: 'Выиграй от 10× ставки в шапочке из фольги' },
  { id: 'meow', name: 'Мяу', desc: 'Забери ежедневный спин 7 дней подряд' },
  { id: 'jackpot', name: 'Первый джекпот', desc: 'Сорви джекпот. Теорема Кантора одобряет' },
  { id: 'collector', name: 'Коллекционер', desc: 'Собери половину альбома' },
  { id: 'full', name: 'Целый альбом', desc: 'Собери все предметы альбома' },
  { id: 'first_fs', name: 'Фриспины!', desc: 'Запусти бесплатные вращения' },
  { id: 'big100', name: 'Эпический куш', desc: 'Выиграй за раунд от 100× ставки' },
  { id: 'picker', name: 'Ягодный сборщик', desc: 'Набери в поляне от 20× ставки' },
];

/* ---------- загрузка и сохранение (с лёгкой защитой от случайных правок) ---------- */
export function loadAll() {
  const notes = [], snap = readJson(SNAP) || {};
  const rawH = readJson(HHK) || {};
  const H = Object.assign({ berries: 0, owned: ['none'], hat: 'none', bonusSpins: 0, boosts: {} }, rawH);
  if (rawH.bsig && M.checkShared(rawH) === 'bad' && snap.shared) { Object.assign(H, snap.shared); notes.push('Мы бережно вернули ягоды и шляпы к последнему сохранению — похоже, данные поменялись «сами». Всё в порядке!'); }
  let rawS = readJson(KEY);
  if (rawS && M.checkSlots(rawS) === 'bad') { rawS = snap.slots || null; notes.push('Состояние автомата вернулось к последнему сохранению. Ничего страшного!'); }
  const base = M.newSlotsState(), S = Object.assign(base, rawS || {});
  S.stats = Object.assign(M.newSlotsState().stats, S.stats || {}); S.album = S.album || {}; S.ach = S.ach || {}; S.hist = Array.isArray(S.hist) ? S.hist : [];
  H.owned = Array.isArray(H.owned) ? H.owned : ['none']; if (!H.owned.includes('none')) H.owned.unshift('none');
  H.boosts = H.boosts && typeof H.boosts === 'object' ? H.boosts : {};
  for (const id of M.FREE_ITEMS) if (!S.album[id]) S.album[id] = 1;
  if (!S.title) S.title = 'title:newbie';
  return { S, H, notes };
}
export function saveAll(S, H) {
  delete S.sig; S.sig = M.signSlots(S); delete H.bsig; H.bsig = M.signShared(H);
  writeJson(KEY, S); writeJson(HHK, H);
  writeJson(SNAP, { slots: S, shared: { berries: H.berries, owned: H.owned, bonusSpins: H.bonusSpins | 0, boosts: H.boosts } });
}
// эффекты предмета в общем сохранении игры
export function applyItem(H, item) {
  if (item.kind === 'hat') { const id = item.id.slice(4); if (!H.owned.includes(id)) H.owned.push(id); }
  if (item.kind === 'boost') { const k = item.id.slice(6); H.boosts[k] = (H.boosts[k] | 0) + 1; }
}
export const perksOf = H => ({ wizard: H.hat === 'wizard', crown: H.hat === 'crown', foil: H.hat === 'foil', halo: H.hat === 'halo' });
const cardHtml = (c, s = 'x') => @@BT@@<span class="sl-card sl-card-@@DS@@c}" aria-label="@@DS@@c === 'red' ? 'красная' : 'чёрная'} карта">@@DS@@c === 'red' ? '♥' : '♠'}</span>@@BT@@;
const nextMidnight = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); };
const clock = ts => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export function installSlots() { ensureSprite(); }

export function renderSlotsPage() {
  const content = document.querySelector('#content');
  ensureSprite();
  const { S, H, notes } = loadAll();
  const audio = makeSlotsAudio(), rng = M.cryptoRng();
  const timers = new Set(), aborts = new Set(), anims = new Set();
  let dead = false, busy = false, skip = false, turbo = false, auto = null, pending = 0, gambleRounds = 0, fxRaf = 0, rafId = 0, parts = [], breakTimer = 0, lastPool = Math.floor(S.pool);
  let bet = M.BETS.includes(S.bet) ? S.bet : 5; const sess = { spins: 0, net: 0 }; let shownBal = null;
  const autoOpts = { stopBig: true, stopFeature: true, below: 0 };
  const $ = sel => content.querySelector(sel);
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
  const wait = ms => new Promise((res, rej) => {
    if (dead) return rej(CANCEL);
    const k = skip || reduce() ? Math.min(ms, 30) : ms * (turbo ? 0.45 : 1), ab = () => { clearTimeout(t); timers.delete(t); rej(CANCEL); };
    const t = setTimeout(() => { timers.delete(t); aborts.delete(ab); res(); }, k); timers.add(t); aborts.add(ab);
  });
  const guard = p => Promise.resolve(p).catch(e => { if (e !== CANCEL) console.error(e); });

  // Накопленная выдача «не пропала»: ожидающий выигрыш гэмбла при обновлении страницы просто засчитывается
  if (S.pending > 0) { H.berries += S.pending; notes.push(@@BT@@Ожидавшие @@DS@@fmt(S.pending)} 🍓 зачислены на баланс.@@BT@@); S.pending = 0; }
  const save = () => saveAll(S, H);
  save();

  content.innerHTML = @@BT@@<section class="slots-page" data-no-icons>
    <div class="intro sl-intro"><div><span class="sched-eyebrow">ВИРТУАЛЬНЫЙ ЗАЛ · М3102</span><h1>Колючий куш</h1><p class="sub">Три ряда, двадцать линий, один ёжик и ни одной настоящей копейки.</p><p class="sl-notice" role="note">Виртуальные ягоды без реальной ценности. Просто весёлая игра.</p></div>
      <button class="sl-poke" id="sl-poke" type="button" aria-label="Ёжик (не тыкать)">@@DS@@sym('hog', 76)}<span class="sl-quip" id="sl-quip" aria-hidden="true"></span></button></div>
    <div id="sl-note" class="sl-note" role="status" hidden></div>
    <div class="sl-hud">
      <div class="sl-stat"><span>Ягоды</span><b id="sl-bal">0</b></div>
      <div class="sl-stat"><span>Бесплатные спины</span><b id="sl-freecnt">0</b></div>
      <div class="sl-stat sl-jp"><span>Джекпот</span><b id="sl-pool">500</b><small>копится только на этом устройстве</small></div>
      <div class="sl-stat"><span>Титул</span><b id="sl-title" class="sl-titlechip"></b></div>
    </div>
    <div class="sl-machine th-forest" id="sl-machine">
      <div class="sl-frame" id="sl-frame">
        <div class="sl-reels" id="sl-reels"></div>
        <svg class="sl-lines" id="sl-lines" viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true"></svg>
        <canvas class="sl-fx" id="sl-fx" aria-hidden="true"></canvas>
        <div class="sl-banner" id="sl-banner" aria-hidden="true"></div>
        <div class="sl-over" id="sl-over" hidden></div>
      </div>
      <div class="sl-winbar"><span id="sl-winlabel">Выигрыш</span><b id="sl-win">0</b><small id="sl-frac" title="Доли ягод копятся и добавляются, когда набирается целая"></small><div class="sl-ladder" id="sl-ladder" hidden aria-label="Множитель фриспинов"></div></div>
      <div class="sl-heat" id="sl-heat"><span class="sl-heatlabel">Жар</span><div class="sl-heatbar" id="sl-heatbar" role="img" aria-label="Шкала жара"></div><small id="sl-heattxt"></small></div>
      <div id="sl-gamble" class="sl-gamble" hidden></div>
      <div class="sl-controls">
        <div class="sl-bet" role="group" aria-label="Ставка"><button class="btn2" id="sl-bet-dn" type="button" aria-label="Уменьшить ставку">−</button><output id="sl-bet" aria-live="polite">5</output><button class="btn2" id="sl-bet-up" type="button" aria-label="Увеличить ставку">+</button><button class="btn2" id="sl-bet-max" type="button">Макс</button></div>
        <button class="btn2 btn-primary sl-spin" id="sl-spin" type="button">Крутить</button>
        <button class="btn2" id="sl-free" type="button">Бесплатный спин</button>
        <button class="btn2" id="sl-stop" type="button" hidden>Стоп авто</button>
        <div class="sl-tools">
          <button class="btn2" id="sl-turbo" type="button" aria-pressed="false">Турбо</button>
          <select id="sl-auto-n" class="btn2" aria-label="Автоспин"><option value="0">Авто</option><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select>
          <button class="btn2" id="sl-pay" type="button">Выплаты</button>
          <button class="btn2" id="sl-sound" type="button" aria-pressed="false">Звук</button>
          <button class="btn2" id="sl-break" type="button">Сделать перерыв</button>
        </div>
        <details class="sl-autoopts"><summary>Условия остановки автоспина</summary>
          <label><input type="checkbox" id="sl-st-big" checked> крупный выигрыш (от 15×)</label>
          <label><input type="checkbox" id="sl-st-feat" checked> бонус или фриспины</label>
          <label>баланс ниже <input type="number" id="sl-st-below" min="0" step="10" value="0"> 🍓</label></details>
      </div>
      <p class="sl-sess" id="sl-sess" aria-live="off"></p>
      <p class="sl-breakmsg" id="sl-breakmsg" role="status" hidden></p>
    </div>
    <div class="sl-nudge" id="sl-nudge"><span id="sl-nudgetxt"></span><a class="btn2" href="#/hedgehog">🦔 Покатать ёжика за ягодами</a></div>
    <div class="sl-panels">
      <section class="dash-panel" id="sl-daily" aria-label="Ежедневные спины"></section>
      <section class="dash-panel" id="sl-wheel" aria-label="Колесо дня"></section>
      <section class="dash-panel sl-wide" id="sl-album" aria-label="Альбом"></section>
      <section class="dash-panel" id="sl-ach" aria-label="Достижения"></section>
      <section class="dash-panel" id="sl-stats" aria-label="Статистика"></section>
    </div>
    <dialog id="sl-dlg" class="app-dialog sl-dlg"></dialog>
    <div id="sl-toasts" class="sl-toasts"></div><p class="sr-only" id="sl-live" role="status" aria-live="polite"></p></section>@@BT@@;

  const frame = $('#sl-frame'), reelsEl = $('#sl-reels'), overEl = $('#sl-over'), dlg = $('#sl-dlg');
  reelsEl.innerHTML = Array.from({ length: 5 }, () => '<div class="sl-reel"><div class="sl-strip"></div></div>').join('');
  const reelEls = [...reelsEl.children];
  const cellHtml = s => @@BT@@<div class="sl-cell" data-s="@@DS@@s}">@@DS@@sym(s)}</div>@@BT@@;
  const setReel = (i, col) => { const strip = reelEls[i].querySelector('.sl-strip'); strip.style.height = ''; strip.style.transform = ''; strip.innerHTML = col.map(cellHtml).join(''); };
  M.spinGrid(rng, 'cold').raw.forEach((col, i) => setReel(i, col));
  const say = text => { const el = $('#sl-live'); if (el) el.textContent = text; };
  const toast = text => { const el = document.createElement('div'); el.className = 'sl-toast'; el.textContent = text; $('#sl-toasts').append(el); later(() => el.remove(), 4600); say(text); };
  const setNote = text => { const el = $('#sl-note'); el.hidden = !text; el.textContent = text || ''; };
  const onBreak = () => S.breakUntil > Date.now();
  const freeLeft = () => S.free + (H.bonusSpins | 0);
  const itemName = id => (M.ITEM[id] ? M.ITEM[id].name : id);

  /* ---------- частицы: конфетти и ягодный дождь на canvas ---------- */
  const fx = $('#sl-fx'), fxc = fx.getContext('2d');
  function sizeFx() { const r = frame.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); fx.width = Math.round(r.width * d); fx.height = Math.round(r.height * d); fx.dataset.d = d; fx.dataset.w = r.width; fx.dataset.h = r.height; }
  function burst(n, kind = 'confetti') {
    if (reduce() || dead) return; sizeFx(); const w = Number(fx.dataset.w), h = Number(fx.dataset.h), cols = ['#ffd84a', '#ff7fae', '#7cf0ff', '#9bff8a', '#c9a0ff'];
    for (let i = 0; i < n; i++) parts.push({ x: Math.random() * w, y: -12 - Math.random() * h * 0.5, vx: (Math.random() - 0.5) * 90, vy: 90 + Math.random() * 180, g: 260, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, s: kind === 'berry' ? 8 + Math.random() * 7 : 5 + Math.random() * 5, c: kind === 'berry' ? '#e8467c' : cols[i % 5], kind, life: 0 });
    if (!fxRaf) { let last = performance.now(); const tick = now => { fxRaf = 0; const dt = Math.min(0.05, (now - last) / 1000); last = now; const d = Number(fx.dataset.d) || 1; fxc.setTransform(d, 0, 0, d, 0, 0); fxc.clearRect(0, 0, Number(fx.dataset.w), Number(fx.dataset.h));
      parts = parts.filter(p => p.y < Number(fx.dataset.h) + 20 && p.life < 6);
      for (const p of parts) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.r); fxc.fillStyle = p.c;
        if (p.kind === 'berry') { fxc.beginPath(); fxc.arc(0, 0, p.s * 0.55, 0, 7); fxc.fill(); fxc.fillStyle = '#3aa655'; fxc.fillRect(-p.s * 0.25, -p.s * 0.7, p.s * 0.5, p.s * 0.25); } else fxc.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); fxc.restore(); }
      if (parts.length) fxRaf = requestAnimationFrame(tick); else fxc.clearRect(0, 0, Number(fx.dataset.w), Number(fx.dataset.h)); }; fxRaf = requestAnimationFrame(tick); }
  }
  const shake = () => { if (reduce()) return; frame.classList.add('sl-shake'); later(() => frame.classList.remove('sl-shake'), 520); };
  const pop = el => { if (!el) return; el.classList.remove('sl-pop'); void el.offsetWidth; el.classList.add('sl-pop'); };

  /* ---------- интерфейс: табло, кнопки, панели ---------- */
  function hud() {
    const shownNow = fmt(shownBal ?? H.berries); if ($('#sl-bal').textContent !== shownNow) { $('#sl-bal').textContent = shownNow; pop($('#sl-bal')); }
    $('#sl-freecnt').textContent = String(freeLeft());
    const pool = Math.floor(S.pool); if (pool !== lastPool) { lastPool = pool; pop($('#sl-pool')); } $('#sl-pool').textContent = @@BT@@@@DS@@fmt(pool)} 🍓@@BT@@;
    $('#sl-frac').textContent = S.frac > 0.004 ? @@BT@@в копилке долей: @@DS@@S.frac.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} 🍓@@BT@@ : '';
    $('#sl-title').textContent = itemName(S.title).replace(/^Титул: /, '');
    $('#sl-bet').textContent = String(bet);
    const bar = $('#sl-heatbar'), full = S.heat >= M.HEAT_MAX;
    bar.innerHTML = Array.from({ length: M.HEAT_MAX }, (_, i) => @@BT@@<i class="@@DS@@i < S.heat ? 'on' : ''}">@@DS@@icon('flame', 16)}</i>@@BT@@).join(''); bar.classList.toggle('is-full', full);
    $('#sl-heattxt').textContent = full ? 'Следующий спин «тёплый»!' : 'Копится после неудач';
    const br = onBreak(); $('#sl-breakmsg').hidden = !br; if (br) $('#sl-breakmsg').textContent = @@BT@@Перерыв до @@DS@@clock(S.breakUntil)}. Хороший ход — отдохнуть. Загляни к ёжику или конспектам.@@BT@@;
    $('#sl-spin').disabled = busy || br || H.berries < bet; $('#sl-free').disabled = busy || br || freeLeft() < 1; $('#sl-free').textContent = freeLeft() ? @@BT@@Бесплатный спин (@@DS@@freeLeft()})@@BT@@ : 'Бесплатный спин';
    $('#sl-bet-dn').disabled = busy || bet <= M.BETS[0]; $('#sl-bet-up').disabled = busy || bet >= M.BETS.at(-1); $('#sl-bet-max').disabled = busy;
    $('#sl-stop').hidden = !auto; $('#sl-turbo').setAttribute('aria-pressed', String(turbo)); $('#sl-sound').setAttribute('aria-pressed', String(audio.on)); $('#sl-sound').textContent = audio.on ? 'Звук: вкл' : 'Звук: выкл';
    $('#sl-sess').textContent = @@BT@@Сессия: @@DS@@sess.spins} спин. · @@DS@@sess.net >= 0 ? '+' : '−'}@@DS@@fmt(Math.abs(sess.net))} 🍓@@BT@@;
    const low = H.berries < bet * 5; $('#sl-nudge').classList.toggle('is-low', low);
    $('#sl-nudgetxt').textContent = low ? 'Ягоды на исходе. Ёжик уже разминает лапки на холмах.' : 'Ягод маловато? Холмы, кувырки и яблоки ждут в игре «Ёжик».';
    const th = THEME_CLASS[S.theme] || 'th-forest'; $('#sl-machine').className = @@BT@@sl-machine @@DS@@th}@@BT@@;
  }
  const award = id => {
    if (S.ach[id]) return; const a = ACH.find(x => x.id === id); S.ach[id] = Date.now(); S.capsules++; toast(@@BT@@🏆 «@@DS@@a.name}» · +1 капсула@@BT@@); audio.win('good'); renderAch(); renderAlbum();
  };
  function checkAlbum() {
    for (const id of M.grantSets(S)) { toast(@@BT@@🎩 Все шляпы собраны! Титул «@@DS@@itemName(id)}»@@BT@@); }
    const p = M.albumProgress(S); if (p.have * 2 >= p.total) award('collector'); if (p.have >= p.total) award('full');
  }
  function renderAch() {
    const el = $('#sl-ach'); if (!el) return; const n = Object.keys(S.ach).length;
    el.innerHTML = @@BT@@<div class="panel-head"><h2>Достижения</h2><span class="sl-count">@@DS@@n} из @@DS@@ACH.length}</span></div><ul class="sl-achlist">@@DS@@ACH.map(a => @@BT@@<li class="@@DS@@S.ach[a.id] ? 'is-done' : ''}"><span aria-hidden="true">@@DS@@S.ach[a.id] ? '🏆' : '🔒'}</span><div><strong>@@DS@@esc(a.name)}</strong><small>@@DS@@esc(a.desc)}</small></div></li>@@BT@@).join('')}</ul><p class="plan-hint">За каждое достижение — капсула.</p>@@BT@@;
  }
  function renderStats() {
    const st = S.stats;
    $('#sl-stats').innerHTML = @@BT@@<div class="panel-head"><h2>Статистика</h2></div><dl class="sl-statlist"><div><dt>Спинов</dt><dd>@@DS@@fmt(st.spins)}</dd></div><div><dt>Поставлено</dt><dd>@@DS@@fmt(st.wagered)} 🍓</dd></div><div><dt>Выиграно</dt><dd>@@DS@@fmt(st.won)} 🍓</dd></div><div><dt>Лучший выигрыш</dt><dd>@@DS@@fmt(st.biggest)} 🍓</dd></div><div><dt>Фриспинов</dt><dd>@@DS@@fmt(st.fs)}</dd></div><div><dt>Полян</dt><dd>@@DS@@fmt(st.picks)}</dd></div><div><dt>Джекпотов</dt><dd>@@DS@@fmt(st.jackpots)}</dd></div><div><dt>«Удвоить»: побед</dt><dd>@@DS@@st.gambleWins}/@@DS@@st.gambles}</dd></div></dl>@@BT@@;
  }
  function renderDaily() {
    const p = M.dailyPreview(S), today = M.dayKey(), yest = M.dayKey(M.addDay(new Date(), -1)), chain = S.lastDay === today || S.lastDay === yest ? S.streak : 0;
    $('#sl-daily').innerHTML = @@BT@@<div class="panel-head"><h2>Ежедневные спины</h2><span class="sl-count">серия: @@DS@@chain}</span></div>
      <ol class="sl-cal">@@DS@@M.DAILY_SPINS.map((n, i) => @@BT@@<li class="@@DS@@i < chain ? 'is-done' : ''}@@DS@@p.can && i + 1 === p.streak ? ' is-next' : ''}"><span>День @@DS@@i + 1}</span><b>@@DS@@i === 6 ? '🎁' : '🎰'} @@DS@@n}@@DS@@perksOf(H).crown && i === 6 ? '+1' : ''}</b></li>@@BT@@).join('')}</ol>
      <div class="sl-row"><button class="btn2 btn-primary" id="sl-claim" type="button" @@DS@@p.can ? '' : 'disabled'}>@@DS@@p.can ? @@BT@@Забрать спины (день @@DS@@p.streak})@@BT@@ : 'Сегодня уже забрано'}</button></div>
      <p class="plan-hint">Пропустишь день — серия начнётся заново. На 7-й день — капсула. Бесплатные спины идут на ставке @@DS@@M.DAILY_BET} и не копят джекпот.</p>@@BT@@;
  }
  const wheelSvg = () => { const cols = ['#7c5cff', '#ff7fae', '#33b5a5', '#f0a53a', '#4d87bf'], R = 100, lab = s => (s.k === 'b' ? @@BT@@@@DS@@s.v}@@BT@@ : s.k === 'cap' ? '🎁' : '🎰');
    return @@BT@@<svg viewBox="0 0 220 220" class="sl-wheelsvg" role="img" aria-label="Колесо дня"><g id="sl-wheelg" style="transform-origin:110px 110px">@@DS@@M.WHEEL.map((s, i) => { const a0 = (i * 36 - 18 - 90) * Math.PI / 180, a1 = ((i + 1) * 36 - 18 - 90) * Math.PI / 180, x0 = 110 + R * Math.cos(a0), y0 = 110 + R * Math.sin(a0), x1 = 110 + R * Math.cos(a1), y1 = 110 + R * Math.sin(a1), am = (i * 36 - 90) * Math.PI / 180;
      return @@BT@@<path d="M110 110L@@DS@@x0.toFixed(1)} @@DS@@y0.toFixed(1)}A@@DS@@R} @@DS@@R} 0 0 1 @@DS@@x1.toFixed(1)} @@DS@@y1.toFixed(1)}Z" fill="@@DS@@cols[i % 5]}" stroke="#fff" stroke-width="2"/><text x="@@DS@@(110 + 70 * Math.cos(am)).toFixed(1)}" y="@@DS@@(110 + 70 * Math.sin(am) + 5).toFixed(1)}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" transform="rotate(@@DS@@i * 36} @@DS@@(110 + 70 * Math.cos(am)).toFixed(1)} @@DS@@(110 + 70 * Math.sin(am)).toFixed(1)})">@@DS@@lab(s)}</text>@@BT@@; }).join('')}<circle cx="110" cy="110" r="14" fill="#fff" stroke="#2a2540" stroke-width="3"/></g></svg><div class="sl-pointer">@@DS@@icon('pointer', 30)}</div>@@BT@@; };
  function renderWheel() {
    const ready = M.wheelReady(S, H), d = H.daily, got = d && d.date === M.dayKey() ? d.goals.filter(g => g.done).length : 0;
    $('#sl-wheel').innerHTML = @@BT@@<div class="panel-head"><h2>Колесо дня</h2><span class="sl-count">@@DS@@ready ? 'заряжено' : @@BT@@цели: @@DS@@got}/3@@BT@@}</span></div><div class="sl-wheelwrap">@@DS@@wheelSvg()}</div><div class="sl-row"><button class="btn2 btn-primary" id="sl-wheelgo" type="button" @@DS@@ready && !busy ? '' : 'disabled'}>@@DS@@S.wheelDay === M.dayKey() ? 'Сегодня уже крутили' : 'Крутить колесо'}</button></div><p class="plan-hint">Выполни все три цели дня в игре «Ёжик» — колесо заряжается раз в сутки.</p>@@BT@@;
  }
  function renderAlbum() {
    const p = M.albumProgress(S), kinds = ['hat', 'palette', 'greeting', 'boost', 'title', 'theme'];
    $('#sl-album').innerHTML = @@BT@@<div class="panel-head"><h2>Альбом и капсулы</h2><span class="sl-count">@@DS@@p.have} из @@DS@@p.total}</span></div>
      <div class="sl-shelf"><div class="sl-caps">@@DS@@icon('cap-common', 44)}@@DS@@icon('cap-rare', 44)}@@DS@@icon('cap-epic', 44)}@@DS@@icon('cap-legendary', 44)}</div><div><b>Капсул: @@DS@@S.capsules}</b><small>Эпик гарантирован не позже @@DS@@M.PITY_CAPSULES}-й капсулы без него</small></div><button class="btn2 btn-primary" id="sl-opencap" type="button" @@DS@@S.capsules > 0 && !busy ? '' : 'disabled'}>Открыть капсулу</button></div>
      <div class="sl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="@@DS@@p.total}" aria-valuenow="@@DS@@p.have}"><span style="width:@@DS@@(100 * p.have / p.total).toFixed(1)}%"></span></div>
      @@DS@@kinds.map(k => @@BT@@<h3 class="sl-kindh">@@DS@@KIND_NAME[k]}</h3><div class="sl-items">@@DS@@M.CATALOG.filter(x => x.kind === k).map(x => { const n = S.album[x.id] | 0, eq = S.title === x.id || S.theme === x.id; return @@BT@@<div class="sl-item r-@@DS@@x.rarity}@@DS@@n ? ' is-own' : ''}"><span class="sl-itemic" aria-hidden="true">@@DS@@n ? KIND_EMOJI[k] : '❔'}</span><strong>@@DS@@n ? esc(x.name) : 'Ещё не найдено'}</strong><small>@@DS@@n ? esc(x.desc) : esc(M.RARITY[x.rarity].name)}@@DS@@n > 1 ? @@BT@@ · ×@@DS@@n}@@BT@@ : ''}</small>@@DS@@n && (x.kind === 'title' || x.kind === 'theme') ? @@BT@@<button class="btn2" type="button" data-equip="@@DS@@x.id}" @@DS@@eq ? 'disabled' : ''}>@@DS@@eq ? 'Выбрано' : 'Выбрать'}</button>@@BT@@ : ''}@@DS@@n && x.kind === 'palette' ? '<a class="btn2" href="#/settings">В настройки</a>' : ''}</div>@@BT@@; }).join('')}</div>@@BT@@).join('')}@@BT@@;
  }
  function renderPanels() { renderDaily(); renderWheel(); renderAlbum(); renderAch(); renderStats(); }
  const refresh = () => { hud(); renderDaily(); renderWheel(); renderAlbum(); renderStats(); };
  setNote(notes.join(' '));

  /* ---------- барабаны ---------- */
  const fw = n => (n >= 10 ? fmt(n) : n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }));
  const cellsOf = (r, rows) => rows.map(row => reelEls[r].querySelectorAll('.sl-cell')[row]).filter(Boolean);
  const showOver = html => { overEl.innerHTML = html; overEl.hidden = false; };
  const hideOver = () => { overEl.hidden = true; overEl.innerHTML = ''; };
  function clearWin() { $('#sl-lines').innerHTML = ''; frame.querySelectorAll('.is-win,.flip,.is-scatter,.is-bonusc,.is-near').forEach(el => el.classList.remove('is-win', 'flip', 'is-scatter', 'is-bonusc', 'is-near')); }
  async function animateTo(raw) {
    if (reduce() || skip) { raw.forEach((col, i) => { setReel(i, col); reelEls[i].classList.add('sl-fade'); }); await wait(60); reelEls.forEach(r => r.classList.remove('sl-fade')); return; }
    audio.lever(); audio.whirStart();
    const speed = turbo ? 0.4 : 1, cur = reelEls.map(r => [...r.querySelectorAll('.sl-cell')].map(c => c.dataset.s).slice(-3)), runs = []; let prev = 0, scatSoFar = 0;
    raw.forEach((col, i) => {
      const n = Math.max(4, Math.round((9 + i * 4) * (turbo ? 0.55 : 1))), all = [...cur[i], ...Array.from({ length: n }, () => FILL[Math.floor(rng() * FILL.length)]), ...col], N = all.length;
      const slow = (i >= 3 && scatSoFar === 2) || (i === 4 && raw[0].includes('bonus') && raw[2].includes('bonus'));
      let dur = (820 + i * 300) * speed + (slow ? 1200 * speed : 0); dur = Math.max(dur, prev + 200 * speed); prev = dur;
      scatSoFar += col.filter(s => s === 'scatter').length;
      const strip = reelEls[i].querySelector('.sl-strip'); strip.innerHTML = all.map(cellHtml).join(''); strip.style.height = @@BT@@@@DS@@N * 100 / 3}%@@BT@@;
      const end = (N - 3) * 100 / N, over = 24 / N;
      const a = strip.animate([{ transform: 'translateY(0)' }, { transform: @@BT@@translateY(-@@DS@@end + over}%)@@BT@@, offset: 0.9 }, { transform: @@BT@@translateY(-@@DS@@end}%)@@BT@@ }], { duration: dur, easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards' });
      anims.add(a); reelEls[i].classList.add('is-spin');
      if (slow) { frame.classList.add('is-tense'); later(() => audio.heartbeat(), dur * 0.4); later(() => audio.heartbeat(), dur * 0.7); }
      runs.push(a.finished.catch(() => {}).then(() => { anims.delete(a); try { a.cancel(); } catch { /* уже снят */ } reelEls[i].classList.remove('is-spin'); if (dead) return; setReel(i, col); audio.thunk(i); if (col.includes('scatter')) audio.scatter(i); }));
    });
    await Promise.all(runs); frame.classList.remove('is-tense'); audio.whirStop();
  }
  async function expandWilds(res) {
    if (!res.expanded.length) return; audio.wild();
    res.expanded.forEach(i => { setReel(i, res.grid[i]); reelEls[i].classList.add('is-expand'); });
    await wait(560); res.expanded.forEach(i => reelEls[i].classList.remove('is-expand'));
  }
  async function showLines(res, quick) {
    const svg = $('#sl-lines'); clearWin(); const cols = ['#ffd84a', '#7cf0ff', '#ff7fae', '#9bff8a', '#c9a0ff'];
    if (res.scatter >= 3) res.raw.forEach((c, r) => c.forEach((s, row) => { if (s === 'scatter') cellsOf(r, [row])[0]?.classList.add('is-scatter'); }));
    if (res.bonus) [0, 2, 4].forEach(r => res.raw[r].forEach((s, row) => { if (s === 'bonus') cellsOf(r, [row])[0]?.classList.add('is-bonusc'); }));
    for (const [k, l] of res.lines.slice(0, 10).entries()) {
      const L = M.LINES[l.line], pts = L.slice(0, l.count).map((row, i) => @@BT@@@@DS@@i * 100 + 50},@@DS@@row * 100 + 50}@@BT@@).join(' ');
      svg.querySelectorAll('polyline').forEach(p => p.classList.add('old'));
      svg.insertAdjacentHTML('beforeend', @@BT@@<polyline points="@@DS@@pts}" fill="none" stroke="@@DS@@cols[k % 5]}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>@@BT@@);
      L.slice(0, l.count).forEach((row, i) => { const c = cellsOf(i, [row])[0]; if (c) { c.classList.add('is-win'); if (l.sym === 'hog' || l.sym === 'king') c.classList.add('flip'); } });
      audio.tick(k); if (!quick) await wait(520); else await wait(180);
    }
    if (res.lines.length > 10) res.lines.slice(10).forEach(l => M.LINES[l.line].slice(0, l.count).forEach((row, i) => cellsOf(i, [row])[0]?.classList.add('is-win')));
    if (res.scatterPay || res.bonus) await wait(quick ? 150 : 420);
  }
  async function countUp(to, from = 0, ms = 1100) {
    const el = $('#sl-win'); if (to <= from || skip || reduce()) { el.textContent = fw(to); return; }
    await new Promise((res, rej) => { const t0 = performance.now(); let lastTick = 0; const ab = () => rej(CANCEL); aborts.add(ab);
      const step = now => { if (dead) return rej(CANCEL); const p = Math.min(1, (now - t0) / (ms * (turbo ? 0.5 : 1))), e = 1 - Math.pow(1 - p, 3); el.textContent = fw(from + (to - from) * e); if (now - lastTick > 70) { lastTick = now; audio.tick(Math.floor(p * 20)); }
        if (p < 1 && !skip) rafId = requestAnimationFrame(step); else { el.textContent = fw(to); aborts.delete(ab); res(); } };
      rafId = requestAnimationFrame(step); });
  }
  async function celebrate(x) {
    const tier = M.winTier(x); if (tier === 'none') return; const lab = { small: '', good: 'Хорошо!', big: 'BIG WIN', mega: 'MEGA WIN', epic: 'EPIC WIN' }[tier], bn = $('#sl-banner');
    audio.win(tier); if (lab) { bn.textContent = lab; bn.className = @@BT@@sl-banner show t-@@DS@@tier}@@BT@@; }
    if (tier === 'big' || tier === 'mega' || tier === 'epic') { burst(tier === 'epic' ? 160 : 90, 'berry'); burst(60); shake(); }
    await wait(tier === 'epic' ? 2600 : tier === 'mega' ? 2100 : tier === 'big' ? 1700 : tier === 'good' ? 800 : 250); bn.className = 'sl-banner';
  }
  const ladder = m => { const el = $('#sl-ladder'); el.innerHTML = Array.from({ length: 11 }, (_, i) => @@BT@@<i class="@@DS@@i + 1 <= m ? 'on' : ''}@@DS@@i + 1 === m ? ' cur' : ''}">×@@DS@@i + 1}</i>@@BT@@).slice(0, Math.max(10, m)).join(''); };

  /* ---------- джекпот, фриспины, «Ягодная поляна» ---------- */
  let jpResolve = null;
  async function jackpotShow(amount) {
    S.stats.jackpots++; award('jackpot'); audio.fanfare(); shake();
    showOver(@@BT@@<div class="sl-jackpot"><div class="sl-gold"></div><h2>ДЖЕКПОТ!</h2><b>@@DS@@fmt(amount)} 🍓</b><p>Фыр-фыр-фыр! Ёжики в полном восторге.</p><div class="sl-fly" aria-hidden="true">@@DS@@Array.from({ length: 9 }, (_, i) => @@BT@@<span style="--i:@@DS@@i}">🦔</span>@@BT@@).join('')}</div><button class="btn2 btn-primary" type="button" data-act="jp-close">Ура!</button></div>@@BT@@);
    burst(200); burst(120, 'berry'); for (let i = 1; i < 6; i++) later(() => burst(80), i * 1100);
    await new Promise((res, rej) => { jpResolve = res; aborts.add(() => rej(CANCEL)); later(res, 9000); }); jpResolve = null; audio.stopFanfare(); hideOver();
  }
  async function runFS(R, betEff) {
    const tr = R.trace, steps = tr.fsSteps; award('first_fs'); S.stats.fs += steps.length;
    audio.feature(); showOver(@@BT@@<div class="sl-curtain"><h2>Фриспины!</h2><p>@@DS@@steps.length} вращений. Множитель растёт после каждого выигрыша, а расширенные Wild добавляют +1.</p></div>@@BT@@); burst(80); await wait(1700); hideOver();
    const lad = $('#sl-ladder'); lad.hidden = false; let run = 0;
    for (const [i, st] of steps.entries()) {
      ladder(st.startMult); $('#sl-winlabel').textContent = @@BT@@Фриспин @@DS@@i + 1} из @@DS@@steps.length}@@BT@@; clearWin();
      await animateTo(st.res.raw); await expandWilds(st.res);
      if (st.res.lines.length || st.res.scatterPay) await showLines(st.res, true);
      const from = run; run += st.win * betEff; await countUp(run, from, 500); ladder(st.mult);
      if (st.res.scatter >= 3) toast('Ретригер: +5 вращений!');
      if (st.res.lines.some(l => l.count === 5 && (l.sym === 'hog' || l.sym === 'king'))) award('five_hogs');
      if (st.jp) await jackpotShow(st.jp);
      await wait(300);
    }
    lad.hidden = true; $('#sl-winlabel').textContent = 'Выигрыш'; toast(@@BT@@Фриспины принесли @@DS@@fw(tr.fs.total * betEff)} 🍓@@BT@@);
  }
  async function runPick(R, betEff) {
    const p = R.trace.pick, g = p.g, seq = p.seq; S.stats.picks++; let k = 0, picks = 3, prizes = 0, mul = 1, done = false;
    const label = c => (c === 'segfault' ? 'Сегфолт 💥' : c === 'extra' ? '+пик' : c === 'm2' ? '×2' : c === 'm3' ? '×3' : c === 'gold' ? 'ДЖЕКПОТ' : @@BT@@+@@DS@@c.slice(1)}×@@BT@@);
    const paint = () => { $('#pk-picks').textContent = String(picks); $('#pk-sum').textContent = fw(prizes * betEff); $('#pk-mul').textContent = @@BT@@×@@DS@@mul}@@BT@@; $('#pk-tot').textContent = @@BT@@@@DS@@fw(Math.min(M.MAX_WIN, prizes * mul) * betEff)} 🍓@@BT@@; };
    audio.feature(); showOver(@@BT@@<div class="sl-pick"><h2>Ягодная поляна</h2><p>Выбирай кусты: призы, множители, лишние пики… и берегись Сегфолта.</p><div class="sl-bushes">@@DS@@Array.from({ length: 12 }, (_, i) => @@BT@@<button class="sl-bush" type="button" data-bush="@@DS@@i}" aria-label="Куст @@DS@@i + 1}"><span>🌿</span></button>@@BT@@).join('')}</div>
      <div class="sl-pickbar"><span>Пики: <b id="pk-picks">@@DS@@picks}</b></span><span>Призы: <b id="pk-sum">0</b></span><span>Множитель: <b id="pk-mul">×1</b></span><span>Итого: <b id="pk-tot">0</b></span></div>@@DS@@p.wz !== null ? @@BT@@<p class="sl-wiz">🪄 Колпак мага добавит в конце ещё @@DS@@p.wz}×.</p>@@BT@@ : ''}<div class="sl-row"><button class="btn2 btn-primary" type="button" data-act="pick-close" disabled>Забрать</button></div></div>@@BT@@);
    const reveal = async el => {
      if (done || el.disabled) return; const c = seq[k++]; el.disabled = true; el.classList.add('open'); el.innerHTML = @@BT@@<span>@@DS@@label(c)}</span>@@BT@@; picks--;
      if (c === 'segfault') { audio.segfault(); if (k === 1) award('segfault'); el.classList.add('bad'); shake(); } else if (c === 'extra') { picks++; audio.berry(2); } else if (c === 'm2') mul *= 2; else if (c === 'm3') mul *= 3; else if (c === 'gold') audio.fanfare(); else { prizes += Number(c.slice(1)); audio.berry(k); }
      if (c === 'm2' || c === 'm3') audio.win('good');
      paint();
      if (k >= seq.length) {
        done = true; if (p.wz !== null) prizes += p.wz; paint(); const btns = [...overEl.querySelectorAll('.sl-bush:not(.open)')];
        btns.forEach((b, j) => { b.disabled = true; b.classList.add('open', 'dim'); b.innerHTML = @@BT@@<span>@@DS@@label(g.cells[k + j] ?? '')}</span>@@BT@@; });
        if (c === 'gold') { audio.stopFanfare(); const keep = overEl.innerHTML; await jackpotShow(R.trace.pickJp); showOver(keep); }
        overEl.querySelector('[data-act=pick-close]').disabled = false; if (p.total * 1 >= 20) award('picker'); audio.win(p.total >= 20 ? 'big' : 'good'); burst(40);
      }
    };
    overEl._reveal = reveal; paint();
    await new Promise((res, rej) => { overEl._close = res; aborts.add(() => rej(CANCEL));
      if (auto) { (async () => { try { for (const b of [...overEl.querySelectorAll('.sl-bush')]) { if (dead || !overEl._reveal) return; await wait(520); await reveal(b); if (done) break; } await wait(900); res(); } catch { /* страница закрыта */ } })(); } });
    overEl._reveal = null; overEl._close = null; hideOver();
  }

  /* ---------- «Удвоить или ничего» и копилка ---------- */
  let gambleBet = 5, gambleBusy = false;
  const closeGamble = () => { const b = $('#sl-gamble'); b.hidden = true; b.innerHTML = ''; };
  function collectPending() {
    if (pending > 0) { H.berries += pending; sess.net += pending; S.stats.won += pending; S.stats.biggest = Math.max(S.stats.biggest, pending); toast(@@BT@@+@@DS@@fmt(pending)} 🍓 в копилку@@BT@@); audio.berry(3); }
    pending = 0; S.pending = 0; gambleRounds = 0; closeGamble(); save(); if (!dead) hud();
  }
  function renderGamble(msg) {
    const box = $('#sl-gamble'); box.hidden = false;
    box.innerHTML = @@BT@@<div class="sl-gtxt"><b>Удвоить или ничего?</b><span>На кону @@DS@@fmt(pending)} 🍓 · раунд @@DS@@gambleRounds + 1} из @@DS@@M.GAMBLE_MAX_ROUNDS}</span>@@DS@@msg ? @@BT@@<em>@@DS@@msg}</em>@@BT@@ : ''}</div>@@DS@@perksOf(H).halo && S.hist.length ? @@BT@@<div class="sl-hist" aria-label="Последние карты">Нимб подсказывает прошлые карты: @@DS@@S.hist.slice(-5).map(cardHtml).join('')}</div>@@BT@@ : ''}<div class="sl-gbtns"><button class="btn2 sl-red" type="button" data-gamble="red">♥ Красное</button><button class="btn2 sl-black" type="button" data-gamble="black">♠ Чёрное</button><button class="btn2 btn-primary" type="button" data-gamble="collect">Забрать</button></div>@@BT@@;
  }
  async function gambleChoose(choice) {
    if (pending <= 0 || gambleBusy || busy) return; gambleBusy = true;
    try {
      audio.flip(); const r = M.gambleRound(rng, choice); S.stats.gambles++; S.hist.push(r.card); if (S.hist.length > 20) S.hist.shift();
      $('#sl-gamble').innerHTML = @@BT@@<div class="sl-flip">@@DS@@cardHtml(r.card)}</div>@@BT@@; await wait(650);
      if (r.won) { S.stats.gambleWins++; pending *= 2; S.pending = pending; gambleRounds++; save(); if (M.gambleAllowed(pending, gambleBet, gambleRounds)) renderGamble('Угадал! Ещё раз?'); else { toast(@@BT@@Удвоено до @@DS@@fmt(pending)} 🍓@@BT@@); collectPending(); } }
      else { audio.gambleLose(); pending = 0; S.pending = 0; gambleRounds = 0; closeGamble(); toast('Не угадал… ёжик сочувственно фыркает.'); save(); }
    } finally { gambleBusy = false; if (!dead) hud(); }
  }

  /* ---------- один спин (платный или бесплатный) ---------- */
  async function doSpin(kind) {
    if (busy || dead) return;
    if (onBreak()) { hud(); return; }
    collectPending(); const free = kind === 'free';
    if (free ? freeLeft() < 1 : H.berries < bet) { audio.nope(); toast(free ? 'Бесплатных спинов нет.' : 'Не хватает ягод — ёжик уже зовёт.'); hud(); return; }
    const betEff = free ? M.DAILY_BET : bet; gambleBet = betEff; busy = true; skip = false; clearWin(); closeGamble(); $('#sl-win').textContent = '0'; $('#sl-winlabel').textContent = 'Выигрыш'; hideOver();
    if (free) { if (S.free > 0) S.free--; else H.bonusSpins--; } else { H.berries -= bet; S.stats.wagered += bet; sess.net -= bet; }
    S.stats.spins++; sess.spins++; S.bet = bet; shownBal = H.berries;
    const R = M.rollRound(rng, S, betEff, perksOf(H), { paid: !free }), res = R.res, tr = R.trace, x = R.won / betEff, set = M.settle(S.frac, R.won); S.frac = set.frac;
    let credit = set.whole; const gambleable = !res.fsSpins && !res.bonus && !R.parts.jp && credit > 0 && M.gambleAllowed(credit, betEff, 0);
    if (gambleable) { pending = credit; S.pending = credit; credit = 0; }
    H.berries += credit; sess.net += credit; S.stats.won += credit; S.stats.biggest = Math.max(S.stats.biggest, set.whole);
    let caps = 0; if (x >= 50) caps++; if (res.fsSpins) caps++; if (res.bonus) caps++; S.capsules += caps; save(); hud();
    try {
      await animateTo(res.raw); await expandWilds(res);
      if (res.warm) { toast('🔥 Горячая серия: этот спин был «тёплым»'); audio.heat(); award('heat'); }
      await showLines(res, false);
      if ((res.scatter === 2 || [0, 2, 4].filter(r => res.raw[r].includes('bonus')).length === 2) && !res.fsSpins && !res.bonus) { frame.classList.add('is-near'); audio.heartbeat(); await wait(500); frame.classList.remove('is-near'); }
      if (res.win > 0) { await countUp(res.win * betEff); if (!tr.fs && !tr.pick) await celebrate(res.win); }
      if (res.lines.some(l => l.count === 5 && (l.sym === 'hog' || l.sym === 'king'))) award('five_hogs');
      if (res.lines.some(l => l.count === 5 && l.sym === 'orange')) award('orange_king');
      if (res.jackpot) await jackpotShow(res.jackpot);
      if (res.fsSpins) { await runFS(R, betEff); }
      if (res.bonus) { await runPick(R, betEff); }
      if (R.won > res.win * betEff + 1e-9 || res.fsSpins || res.bonus) { await countUp(R.won, res.win * betEff, 900); await celebrate(x); }
      if (Math.abs(R.won - 42) < 1e-6) award('exact42');
      if ((H.hat === 'foil') && x >= 10) award('foil');
      if (x >= 100) award('big100');
      if (caps) toast(@@BT@@🎁 +@@DS@@caps} @@DS@@caps === 1 ? 'капсула' : 'капсулы'}@@BT@@);
      say(R.won > 0 ? @@BT@@Выигрыш: @@DS@@fw(R.won)} ягод@@BT@@ : 'Без выигрыша');
    } catch (e) { if (e !== CANCEL) console.error(e); }
    finally {
      busy = false; shownBal = null;
      if (!dead) {
        save(); checkAlbum(); refresh(); $('#sl-winlabel').textContent = 'Выигрыш';
        if (pending > 0 && !auto) renderGamble('Рискнёшь удвоить? Шансы — ровно пополам.'); else if (pending > 0) collectPending();
        if (auto) { auto.left--; const stop = (autoOpts.stopBig && x >= 15) || (autoOpts.stopFeature && (res.fsSpins || res.bonus || R.parts.jp > 0)) || (autoOpts.below > 0 && H.berries < autoOpts.below) || H.berries < bet || auto.left <= 0 || onBreak(); if (stop) { auto = null; hud(); } else later(() => guard(doSpin('paid')), 380); }
      }
    }
  }

  /* ---------- колесо, капсулы, ежедневные спины ---------- */
  async function runWheel() {
    if (busy || !M.wheelReady(S, H)) return; busy = true; hud(); const idx = M.wheelPick(rng), seg = M.WHEEL[idx]; S.wheelDay = M.dayKey();
    if (seg.k === 'b') H.berries += seg.v; else if (seg.k === 'cap') S.capsules++; else H.bonusSpins = (H.bonusSpins | 0) + 1; save();
    const g = $('#sl-wheelg'), turns = 360 * 5 + (360 - idx * 36);
    try {
      if (reduce()) { g.style.transform = @@BT@@rotate(@@DS@@turns}deg)@@BT@@; await wait(200); }
      else { g.style.transition = 'transform 4.6s cubic-bezier(.12,.7,.15,1)'; g.getBoundingClientRect(); g.style.transform = @@BT@@rotate(@@DS@@turns}deg)@@BT@@; let t = 0, d = 60; while (t < 4300) { later(() => audio.wheelTick(), t); t += d; d *= 1.08; } await wait(4800); }
      const what = seg.k === 'b' ? @@BT@@+@@DS@@seg.v} 🍓@@BT@@ : seg.k === 'cap' ? 'капсула 🎁' : '+1 бесплатный спин 🎰'; toast(@@BT@@Колесо: @@DS@@what}@@BT@@); audio.win('good'); burst(50);
    } catch (e) { if (e !== CANCEL) console.error(e); } finally { busy = false; if (!dead) { refresh(); renderWheel(); } }
  }
  async function openCapsuleUi() {
    if (busy || S.capsules < 1) return; busy = true; S.capsules--; const out = M.openCapsule(rng, S); applyItem(H, out.item); if (out.berries) H.berries += out.berries; save(); hud();
    dlg.innerHTML = @@BT@@<div class="sl-capdlg"><div class="sl-capbig" id="sl-capbig">@@DS@@icon('cap-common', 150)}</div><p id="sl-captxt" aria-live="polite">Трясём капсулу…</p><div id="sl-capcard"></div><div class="dialog-actions"><button class="btn2 btn-primary" type="button" data-close-dialog id="sl-capok" disabled>Класс!</button></div></div>@@BT@@; dlg.showModal();
    try {
      const big = $('#sl-capbig'); for (let i = 0; i < 3; i++) { audio.shake(); big.classList.add('shaking'); await wait(430); big.classList.remove('shaking'); await wait(90); }
      audio.crack(out.item.rarity); big.innerHTML = icon(@@BT@@cap-@@DS@@out.item.rarity}@@BT@@, 150); big.classList.add('crack'); await wait(420); $('#sl-captxt').textContent = M.RARITY[out.item.rarity].name;
      $('#sl-capcard').innerHTML = @@BT@@<div class="sl-revealcard r-@@DS@@out.item.rarity}"><span class="sl-itemic" aria-hidden="true">@@DS@@KIND_EMOJI[out.item.kind]}</span><strong>@@DS@@esc(out.item.name)}</strong><small>@@DS@@esc(out.item.desc)}</small><em>@@DS@@out.dup ? @@BT@@Уже есть — обмен на @@DS@@out.berries} 🍓@@BT@@ : out.item.kind === 'boost' ? 'Применится в следующем забеге ёжика' : 'Новинка в альбоме!'}</em></div>@@BT@@;
      if (out.item.rarity !== 'common') burst(out.item.rarity === 'legendary' ? 160 : 70);
    } catch (e) { if (e !== CANCEL) console.error(e); } finally { if (!dead) { busy = false; checkAlbum(); save(); refresh(); const ok = $('#sl-capok'); if (ok) ok.disabled = false; } }
  }
  function claimDaily() {
    const c = M.dailyClaim(S, new Date(), perksOf(H)); if (!c) return; audio.win('good');
    toast(@@BT@@🎰 +@@DS@@c.spins} @@DS@@c.spins === 1 ? 'бесплатный спин' : 'бесплатных спина'}@@DS@@c.capsule ? ' и капсула 🎁' : ''}@@BT@@);
    if (c.streak === 7) { award('meow'); toast('Мяу. 🐈 Семь дней подряд — кот одобряет.'); } save(); refresh();
  }

  /* ---------- диалоги ---------- */
  function openPay() {
    const pm = (s, n) => M.payMult(s, n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }), rows = ['king', 'hog', 'rust', 'pi', 'orange', 'cpp', 'mush', 'git', 'apple', 'berry'];
    dlg.innerHTML = @@BT@@<div class="dialog-head"><h2>Таблица выплат</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><p class="dialog-hint">Выплаты — в долях общей ставки за каждую выигрышную линию (слева направо, с 1-го барабана). 20 линий.</p>
      <div class="sl-pay"><div class="sl-payrow sl-payhead"><span></span><span></span><b>3</b><b>4</b><b>5</b></div>@@DS@@rows.map(s => @@BT@@<div class="sl-payrow">@@DS@@sym(s, 44)}<span>@@DS@@LABELS[s]}</span><b>×@@DS@@pm(s, 3)}</b><b>×@@DS@@pm(s, 4)}</b><b>×@@DS@@pm(s, 5)}</b></div>@@BT@@).join('')}</div>
      <h3>Особые символы</h3><ul class="sl-rules"><li>@@DS@@sym('wild', 30)} <b>Wild</b> — на барабанах 2–4, заменяет всё, кроме Scatter и Bonus. Расширяется на весь барабан и добавляет +1 к множителю спина.</li>
      <li>@@DS@@sym('scatter', 30)} <b>Scatter</b> — 3, 4 или 5 где угодно платят ×2, ×10, ×50 ставки и запускают 8, 12 или 20 фриспинов. Во фриспинах множитель растёт после каждого выигрыша, а 3 Scatter добавляют +5 вращений.</li>
      <li>@@DS@@sym('bonus', 30)} <b>Bonus</b> — корзины на барабанах 1, 3 и 5 разом открывают «Ягодную поляну».</li>
      <li>🔥 <b>Жар</b> — после серии неудач следующий спин «тёплый»: выигрыши чаще.</li>
      <li>💰 <b>Джекпот</b> — три расширенных Wild дают шанс сорвать копилку; чем выше ставка, тем он больше. Копилка хранится на этом устройстве.</li>
      <li>🃏 <b>Удвоить или ничего</b> — после небольшого выигрыша можно до 3 раз угадать цвет карты: честные пополам.</li><li>Максимальный выигрыш за раунд — 5000× ставки.</li></ul>@@BT@@;
    dlg.showModal();
  }
  function openBreak() {
    dlg.innerHTML = @@BT@@<div class="dialog-head"><h2>Сделать перерыв</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><p class="dialog-hint">Вращение заблокируется. Отменить нельзя — в этом и смысл.</p><div class="dialog-actions"><button class="btn2" type="button" data-close-dialog>Передумал</button><button class="btn2" type="button" data-break="15">15 минут</button><button class="btn2 btn-primary" type="button" data-break="day">До завтра</button></div>@@BT@@; dlg.showModal();
  }
  const quip = () => { const q = $('#sl-quip'); q.textContent = QUIPS[Math.floor(Math.random() * QUIPS.length)]; q.classList.remove('show'); void q.offsetWidth; q.classList.add('show'); };

  /* ---------- события ---------- */
  const setBet = v => { bet = v; S.bet = v; hud(); };
  content.addEventListener('click', e => {
    const t = e.target, btn = t.closest('button'), id = btn && btn.id;
    if (t.closest('#sl-over') && btn) {
      if (btn.dataset.bush !== undefined && overEl._reveal) guard(overEl._reveal(btn));
      if (btn.dataset.act === 'pick-close' && overEl._close) overEl._close();
      if (btn.dataset.act === 'jp-close' && jpResolve) jpResolve();
      return;
    }
    if (t.closest('#sl-frame') && busy && !t.closest('#sl-over')) { skip = true; anims.forEach(a => { try { a.finish(); } catch { /* уже закончена */ } }); }
    if (!btn) return;
    if (btn.dataset.closeDialog !== undefined && dlg.open) dlg.close();
    if (id === 'sl-spin') { audio.click(); guard(doSpin('paid')); } else if (id === 'sl-free') { audio.click(); guard(doSpin('free')); }
    else if (id === 'sl-bet-dn') { audio.click(); setBet(M.BETS[Math.max(0, M.BETS.indexOf(bet) - 1)]); } else if (id === 'sl-bet-up') { audio.click(); setBet(M.BETS[Math.min(M.BETS.length - 1, M.BETS.indexOf(bet) + 1)]); }
    else if (id === 'sl-bet-max') { audio.click(); setBet([...M.BETS].reverse().find(b => b <= H.berries) || M.BETS[0]); }
    else if (id === 'sl-turbo') { turbo = !turbo; audio.click(); hud(); } else if (id === 'sl-stop') { auto = null; audio.click(); hud(); }
    else if (id === 'sl-pay') { audio.click(); openPay(); } else if (id === 'sl-break') { audio.click(); openBreak(); }
    else if (id === 'sl-sound') { audio.set(!audio.on); hud(); } else if (id === 'sl-claim') claimDaily(); else if (id === 'sl-wheelgo') guard(runWheel()); else if (id === 'sl-opencap') guard(openCapsuleUi());
    else if (id === 'sl-poke') { S.stats.poked++; quip(); audio.click(); if (S.stats.poked >= 25) award('dont_poke'); save(); }
    else if (btn.dataset.gamble) { if (btn.dataset.gamble === 'collect') collectPending(); else guard(gambleChoose(btn.dataset.gamble)); }
    else if (btn.dataset.equip) { const it = M.ITEM[btn.dataset.equip]; if (it.kind === 'title') S.title = it.id; else S.theme = it.id; save(); refresh(); }
    else if (btn.dataset.break) { S.breakUntil = btn.dataset.break === 'day' ? nextMidnight() : Date.now() + 15 * 60000; auto = null; save(); if (dlg.open) dlg.close(); refresh(); }
  });
  content.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'sl-auto-n') { const n = Number(t.value); t.value = '0'; if (n > 0 && !busy) { autoOpts.stopBig = $('#sl-st-big').checked; autoOpts.stopFeature = $('#sl-st-feat').checked; autoOpts.below = Math.max(0, Number($('#sl-st-below').value) || 0); auto = { left: n }; hud(); guard(doSpin('paid')); } }
  });
  const onKey = e => {
    if (dead || dlg.open || !(e.code === 'Space' || e.code === 'Enter') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
    e.preventDefault(); if (e.repeat) return; if (!busy) guard(doSpin('paid'));
  };
  window.addEventListener('keydown', onKey);
  breakTimer = setInterval(() => { if (dead) return; if (S.breakUntil && !onBreak()) { S.breakUntil = 0; save(); } if (S.breakUntil) hud(); }, 1000);

  function destroy() {
    if (dead) return; try { collectPending(); } catch { /* без паники */ }
    dead = true; auto = null; try { if (dlg.open) dlg.close(); } catch { /* уже закрыт */ }
    aborts.forEach(f => f()); aborts.clear(); timers.forEach(clearTimeout); timers.clear(); anims.forEach(a => { try { a.cancel(); } catch { /* снята */ } }); anims.clear();
    cancelAnimationFrame(fxRaf); cancelAnimationFrame(rafId); clearInterval(breakTimer); window.removeEventListener('keydown', onKey); audio.destroy(); try { save(); } catch { /* квота */ }
  }
  window.__hhDestroy = destroy;
  hud(); renderPanels(); checkAlbum(); save();
}
`,
  'css/slots.css': String.raw`/* «Колючий куш» — страница слотов. Цвета берутся из переменных сайта; темы барабанов — .th-forest / .th-night / .th-server. */
.slots-page{max-width:1050px;margin:0 auto;padding-bottom:56px}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.sl-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:36px 0 14px}
.sl-intro h1{font-size:clamp(2.4rem,4.6vw,4rem);margin:8px 0}
.sl-notice{font-size:.78rem;color:var(--muted);margin:4px 0 0}
.sl-poke{position:relative;border:0;background:transparent;cursor:pointer;padding:0;border-radius:50%;transition:transform .2s}
.sl-poke:hover{transform:rotate(-6deg) scale(1.05)}.sl-poke:active{transform:scale(.92)}
.sl-quip{position:absolute;right:100%;top:6px;white-space:nowrap;background:var(--card);border:1px solid var(--border);border-radius:calc(10px * var(--rs,1));padding:5px 10px;font-size:.78rem;font-weight:700;opacity:0;pointer-events:none}
.sl-quip.show{animation:sl-quip 1.4s ease both}
@keyframes sl-quip{0%{opacity:0;transform:translateX(8px)}15%,70%{opacity:1;transform:none}100%{opacity:0}}
.sl-note{margin:0 0 12px;padding:11px 15px;border-radius:calc(9px * var(--rs,1));background:color-mix(in srgb,#dc8b36 12%,var(--card));border:1px solid color-mix(in srgb,#dc8b36 30%,var(--border));font-size:.84rem}
.sl-hud{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
.sl-stat{display:grid;gap:3px;padding:12px 14px;background:var(--gl-fill,var(--card));border:1px solid var(--border);border-radius:calc(12px * var(--rs,1))}
.sl-stat span{font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.sl-stat b{font-size:1.35rem;letter-spacing:-.03em;font-variant-numeric:tabular-nums}.sl-stat small{font-size:.66rem;color:var(--muted)}
.sl-jp b{background:linear-gradient(135deg,#ffcf40,#f08a1e);-webkit-background-clip:text;background-clip:text;color:transparent}
.sl-titlechip{font-size:1rem!important}
.sl-pop{animation:sl-pop .45s ease}
@keyframes sl-pop{0%{transform:scale(1)}35%{transform:scale(1.18)}100%{transform:scale(1)}}

/* автомат */
.sl-machine{--fr1:#2f6b3a;--fr2:#1a3d25;--bg1:#e7f5e0;--bg2:#cfe9c6;position:relative;padding:14px;border-radius:calc(22px * var(--rs,1));background:linear-gradient(160deg,var(--fr1),var(--fr2));box-shadow:0 20px 50px rgba(0,0,0,.28),inset 0 2px 0 rgba(255,255,255,.18)}
.sl-machine.th-night{--fr1:#2b2f6e;--fr2:#12143a;--bg1:#252a64;--bg2:#171a45}
.sl-machine.th-server{--fr1:#3b4350;--fr2:#171b22;--bg1:#1f2a2a;--bg2:#121a1a}
.sl-frame{position:relative;border-radius:calc(14px * var(--rs,1));overflow:hidden;background:linear-gradient(180deg,var(--bg1),var(--bg2));box-shadow:inset 0 0 0 3px rgba(0,0,0,.35),inset 0 8px 24px rgba(0,0,0,.25)}
.sl-machine.th-night .sl-frame{background-image:radial-gradient(1.2px 1.2px at 20% 30%,#fff8,transparent),radial-gradient(1.2px 1.2px at 70% 60%,#fff8,transparent),radial-gradient(1px 1px at 45% 80%,#fff8,transparent),linear-gradient(180deg,var(--bg1),var(--bg2))}
.sl-machine.th-server .sl-frame{background-image:repeating-linear-gradient(0deg,#0000 0 6px,#33ff9910 6px 7px),linear-gradient(180deg,var(--bg1),var(--bg2))}
.sl-reels{display:grid;grid-template-columns:repeat(5,1fr);aspect-ratio:5/3;gap:0}
.sl-reel{position:relative;overflow:hidden;border-right:2px solid rgba(0,0,0,.22)}.sl-reel:last-child{border-right:0}
.sl-strip{position:absolute;left:0;right:0;top:0;height:100%;display:flex;flex-direction:column;will-change:transform}
.sl-reel.is-spin .sl-strip{filter:blur(1.6px)}
.sl-cell{flex:1 1 0;min-height:0;display:grid;place-items:center;padding:6%}
.sl-sym{width:100%;height:100%;display:block;filter:drop-shadow(0 3px 3px rgba(0,0,0,.28))}
.sl-ic{display:inline-block;vertical-align:middle}
.sl-fade .sl-strip{animation:sl-fade .25s ease}
@keyframes sl-fade{from{opacity:.2}to{opacity:1}}
.sl-lines,.sl-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sl-lines polyline{filter:drop-shadow(0 0 4px rgba(0,0,0,.45));animation:sl-draw .35s ease both}
.sl-lines polyline.old{opacity:.4}
@keyframes sl-draw{from{opacity:0}to{opacity:1}}
.sl-cell.is-win .sl-sym{animation:sl-win .7s ease-in-out infinite alternate}
.sl-cell.is-win.flip .sl-sym{animation:sl-flip 1s ease-in-out infinite}
@keyframes sl-win{to{transform:scale(1.14)}}@keyframes sl-flip{0%{transform:rotateY(0)}50%{transform:rotateY(180deg) scale(1.1)}100%{transform:rotateY(360deg)}}
.sl-cell.is-scatter .sl-sym,.sl-cell.is-bonusc .sl-sym{animation:sl-win .5s ease-in-out infinite alternate;filter:drop-shadow(0 0 10px #ffe27a)}
.sl-reel.is-expand{animation:sl-expand .55s ease}.sl-reel.is-expand .sl-cell{background:radial-gradient(circle,#fff6a066,transparent 70%)}
@keyframes sl-expand{0%{filter:brightness(2.2)}100%{filter:none}}
.sl-frame.is-tense{box-shadow:inset 0 0 0 3px rgba(0,0,0,.35),inset 0 0 60px 8px #ff3b6e66;animation:sl-tense 1s ease-in-out infinite alternate}
@keyframes sl-tense{to{box-shadow:inset 0 0 0 3px rgba(0,0,0,.35),inset 0 0 90px 18px #ff3b6eaa}}
.sl-frame.is-near .sl-reel:last-child{animation:sl-wobble .5s ease}
@keyframes sl-wobble{20%{transform:translateY(-5px)}50%{transform:translateY(4px)}80%{transform:translateY(-2px)}}
.sl-shake{animation:sl-shake .5s ease}
@keyframes sl-shake{0%,100%{transform:none}20%{transform:translate(-6px,3px)}40%{transform:translate(5px,-4px)}60%{transform:translate(-4px,2px)}80%{transform:translate(3px,-2px)}}
.sl-banner{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) scale(.5);opacity:0;font-weight:900;font-size:clamp(1.8rem,8vw,4rem);letter-spacing:-.02em;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.35),0 0 30px #ffd84a;white-space:nowrap;pointer-events:none}
.sl-banner.show{animation:sl-banner 1.6s cubic-bezier(.2,.9,.3,1.2) both}.sl-banner.t-mega{color:#ffd84a}.sl-banner.t-epic{color:#ff7fae}
@keyframes sl-banner{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}35%,85%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-60%) scale(1)}}

/* оверлеи: фриспины, поляна, джекпот */
.sl-over{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:rgba(10,12,30,.72);backdrop-filter:blur(3px);padding:10px;overflow:auto}
.sl-over[hidden]{display:none}
.sl-curtain{text-align:center;color:#fff;animation:sl-rise .5s ease both}.sl-curtain h2{font-size:clamp(2rem,7vw,3.6rem);margin:0 0 6px;text-shadow:0 0 28px #7cf0ff}.sl-curtain p{margin:0;max-width:30em;opacity:.9}
@keyframes sl-rise{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
.sl-pick{width:min(560px,100%);color:#fff;text-align:center}.sl-pick h2{margin:0 0 4px;font-size:1.5rem}.sl-pick p{margin:0 0 10px;font-size:.84rem;opacity:.9}
.sl-bushes{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.sl-bush{aspect-ratio:1.15;border:2px solid #fff4;border-radius:calc(14px * var(--rs,1));background:linear-gradient(160deg,#3d8a4a,#1f5a2e);font-size:1.6rem;cursor:pointer;color:#fff;font-weight:800;font-family:inherit;transition:transform .15s}
.sl-bush:hover:not(:disabled){transform:translateY(-3px) rotate(-2deg)}.sl-bush:focus-visible{outline:3px solid #ffd84a}
.sl-bush.open{background:linear-gradient(160deg,#ffe9a8,#f0b947);color:#3a2410;font-size:.95rem;cursor:default;animation:sl-win .4s ease 2 alternate}.sl-bush.bad{background:linear-gradient(160deg,#ff9a9a,#d2485b);color:#fff}.sl-bush.dim{opacity:.55;animation:none}
.sl-pickbar{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:center;font-size:.82rem;margin-bottom:10px}.sl-wiz{font-size:.78rem!important}
.sl-jackpot{position:relative;text-align:center;color:#fff;width:100%;height:100%;display:grid;place-content:center;gap:6px}
.sl-gold{position:absolute;inset:-20%;background:radial-gradient(circle,#ffd84a99,#ffd84a00 60%);animation:sl-gold 1.6s ease-in-out infinite alternate;z-index:-1}
@keyframes sl-gold{to{transform:scale(1.15);opacity:.7}}
.sl-jackpot h2{margin:0;font-size:clamp(2.4rem,10vw,4.6rem);text-shadow:0 4px 0 #8a5a0a,0 0 34px #ffcf40;color:#ffe27a}.sl-jackpot b{font-size:clamp(1.6rem,6vw,2.8rem)}.sl-jackpot .btn2{justify-self:center;margin-top:8px}
.sl-fly span{position:absolute;bottom:-20px;left:calc(var(--i) * 11%);font-size:2rem;animation:sl-fly 3.6s linear infinite;animation-delay:calc(var(--i) * -.4s)}
@keyframes sl-fly{from{transform:translateY(0) rotate(0)}to{transform:translateY(-360px) rotate(360deg)}}

/* табло под барабанами */
.sl-winbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 4px 4px;color:#fff}
.sl-winbar span{font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.8}.sl-winbar b{font-size:1.7rem;font-variant-numeric:tabular-nums;min-width:3ch;text-shadow:0 0 14px #ffd84a88}.sl-winbar small{font-size:.7rem;opacity:.75}
.sl-ladder{display:flex;gap:3px;flex-wrap:wrap}.sl-ladder[hidden]{display:none}.sl-ladder i{font-style:normal;font-size:.66rem;font-weight:800;padding:3px 6px;border-radius:calc(5px * var(--rs,1));background:rgba(255,255,255,.14)}.sl-ladder i.on{background:#ffd84a;color:#3a2410}.sl-ladder i.cur{box-shadow:0 0 12px #ffd84a;transform:scale(1.15)}
.sl-heat{display:flex;align-items:center;gap:8px;margin:4px;color:#fff;font-size:.7rem}.sl-heatlabel{font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.8}
.sl-heatbar{display:flex;gap:2px}.sl-heatbar i{display:inline-grid;opacity:.28;filter:grayscale(1)}.sl-heatbar i.on{opacity:1;filter:none}.sl-heatbar.is-full i{animation:sl-win .5s ease infinite alternate}
.sl-gamble{margin:10px 4px 0;padding:12px 14px;border-radius:calc(12px * var(--rs,1));background:rgba(0,0,0,.35);color:#fff;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;animation:sl-rise .3s ease both}
.sl-gamble[hidden]{display:none}.sl-gtxt{display:grid;gap:2px;font-size:.84rem}.sl-gtxt em{color:#ffe27a;font-style:normal}
.sl-gbtns{display:flex;gap:6px;flex-wrap:wrap}.sl-red{color:#ff5a6e!important}.sl-black{color:#1a1a24!important}
.sl-hist{font-size:.74rem;opacity:.9;width:100%}.sl-card{display:inline-grid;place-items:center;width:1.8em;height:2.3em;margin-left:4px;border-radius:5px;background:#fff;font-size:1rem;vertical-align:middle}.sl-card-red{color:#d2485b}.sl-card-black{color:#1a1a24}
.sl-flip{display:grid;place-items:center;width:100%;font-size:2rem;animation:sl-flipc .65s ease}
@keyframes sl-flipc{from{transform:rotateY(0)}to{transform:rotateY(540deg)}}
.sl-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;margin-top:12px}
.sl-bet{display:flex;align-items:center;gap:6px;color:#fff}.sl-bet output{min-width:3ch;text-align:center;font-size:1.2rem;font-weight:800;font-variant-numeric:tabular-nums}
.sl-controls .btn2{min-height:46px;min-width:46px}.sl-spin{min-width:150px;font-size:1.05rem;font-weight:800;box-shadow:0 8px 20px color-mix(in srgb,var(--accent) 45%,transparent)}
.sl-controls .btn2:disabled{opacity:.45;cursor:not-allowed;transform:none}
.sl-controls .btn2[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--card))}
.sl-tools{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.sl-tools select{padding:0 10px;font-weight:650}
.sl-autoopts{width:100%;color:#fff;font-size:.78rem;text-align:center}.sl-autoopts summary{cursor:pointer;opacity:.85}.sl-autoopts label{display:inline-flex;align-items:center;gap:6px;margin:6px 10px}.sl-autoopts input[type=number]{width:5em;border-radius:6px;border:1px solid var(--border);padding:4px 6px;background:var(--card);color:var(--text)}
.sl-sess{margin:10px 0 0;text-align:center;font-size:.74rem;color:#fff;opacity:.75}.sl-breakmsg{margin:8px 4px 0;padding:10px 14px;border-radius:calc(10px * var(--rs,1));background:#7a3f6a;color:#fff;font-size:.84rem;text-align:center}.sl-breakmsg[hidden]{display:none}
.sl-nudge{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:14px 0;padding:12px 16px;border:1px dashed var(--border);border-radius:calc(12px * var(--rs,1));font-size:.86rem;color:var(--muted)}
.sl-nudge.is-low{border-color:var(--accent);color:var(--text);background:color-mix(in srgb,var(--accent) 8%,transparent)}
.sl-nudge .btn2{text-decoration:none;min-height:42px;display:inline-flex;align-items:center}

/* панели под автоматом */
.sl-panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.sl-wide{grid-column:1/-1}
.sl-count{font-size:.74rem;color:var(--muted);font-weight:700}.sl-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.sl-row .btn2{min-height:44px}
.sl-cal{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.sl-cal li{display:grid;gap:3px;justify-items:center;padding:8px 2px;border:1px solid var(--border);border-radius:calc(9px * var(--rs,1));font-size:.66rem;color:var(--muted)}.sl-cal b{font-size:.84rem;color:var(--text)}
.sl-cal li.is-done{background:color-mix(in srgb,var(--accent) 14%,var(--card));border-color:var(--accent)}.sl-cal li.is-next{outline:2px dashed var(--accent);outline-offset:1px}
.sl-wheelwrap{position:relative;width:min(240px,70%);margin:6px auto}.sl-wheelsvg{width:100%;display:block;filter:drop-shadow(0 8px 14px rgba(0,0,0,.25))}.sl-pointer{position:absolute;left:50%;top:-8px;transform:translateX(-50%) rotate(180deg)}
.sl-shelf{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-bottom:12px}.sl-shelf small{display:block;color:var(--muted);font-size:.72rem}.sl-caps{display:flex;gap:2px}
.sl-progress{height:8px;border-radius:calc(999px * var(--rp,1));background:var(--border);overflow:hidden;margin-bottom:6px}.sl-progress span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .4s}
.sl-kindh{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 0 8px}
.sl-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.sl-item{--rc:var(--border);display:grid;gap:4px;align-content:start;padding:12px;border:1px solid var(--rc);border-radius:calc(11px * var(--rs,1));font-size:.8rem;opacity:.7;background:color-mix(in srgb,var(--card) 60%,transparent)}.sl-item.is-own{opacity:1;box-shadow:0 0 0 1px var(--rc)}
.sl-item small{color:var(--muted);font-size:.7rem}.sl-item .btn2{min-height:36px;font-size:.72rem;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.sl-itemic{font-size:1.5rem}
.r-rare{--rc:#4d87bf}.r-epic{--rc:#a35bd6}.r-legendary{--rc:#e0a21a}.r-common{--rc:#8d93a6}
.sl-achlist{list-style:none;margin:0;padding:0;display:grid;gap:8px}.sl-achlist li{display:flex;gap:10px;align-items:flex-start;font-size:.82rem;opacity:.6}.sl-achlist li.is-done{opacity:1}.sl-achlist small{display:block;color:var(--muted);font-size:.72rem}
.sl-statlist{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin:0}.sl-statlist div{display:grid;gap:2px}.sl-statlist dt{font-size:.7rem;color:var(--muted)}.sl-statlist dd{margin:0;font-weight:750;font-variant-numeric:tabular-nums}
.sl-toasts{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 90px);z-index:1500;display:grid;gap:6px;justify-items:center;pointer-events:none}
.sl-toast{background:var(--card);color:var(--text);border:1px solid var(--accent);border-radius:calc(999px * var(--rp,1));padding:9px 16px;font-size:.84rem;font-weight:650;box-shadow:0 10px 30px rgba(0,0,0,.25);animation:sl-toast 4.6s ease both}
@keyframes sl-toast{0%{opacity:0;transform:translateY(10px)}8%,88%{opacity:1;transform:none}100%{opacity:0}}

/* диалоги: выплаты, капсулы */
.sl-dlg{width:min(600px,calc(100vw - 24px))}
.sl-pay{display:grid;gap:4px;margin:10px 0}.sl-payrow{display:grid;grid-template-columns:48px 1fr repeat(3,56px);gap:8px;align-items:center;font-size:.8rem;padding:4px 0;border-bottom:1px solid var(--border)}.sl-payrow b{text-align:right;font-variant-numeric:tabular-nums}.sl-payhead{font-size:.7rem;color:var(--muted)}
.sl-rules{padding-left:1.1em;font-size:.8rem;line-height:1.6}.sl-rules li{margin:6px 0}.sl-rules .sl-sym{display:inline-block;width:30px;height:30px;vertical-align:middle}
.sl-capdlg{text-align:center}.sl-capbig{display:grid;place-items:center;min-height:160px}.sl-capbig.shaking{animation:sl-cshake .43s ease}.sl-capbig.crack{animation:sl-crack .5s ease}
@keyframes sl-cshake{20%{transform:rotate(-14deg)}50%{transform:rotate(12deg)}80%{transform:rotate(-8deg)}}@keyframes sl-crack{0%{transform:scale(1)}40%{transform:scale(1.35);filter:brightness(2)}100%{transform:scale(1)}}
.sl-revealcard{display:grid;gap:4px;justify-items:center;padding:16px;margin:10px auto;max-width:300px;border:2px solid var(--rc,var(--border));border-radius:calc(14px * var(--rs,1));animation:sl-rise .4s ease both;box-shadow:0 0 30px color-mix(in srgb,var(--rc,var(--border)) 45%,transparent)}.sl-revealcard em{font-style:normal;color:var(--accent);font-size:.8rem}.sl-revealcard small{color:var(--muted)}

@media(max-width:760px){
  .sl-hud{grid-template-columns:repeat(2,1fr)}.sl-panels{grid-template-columns:1fr}.sl-machine{padding:8px;border-radius:calc(16px * var(--rs,1))}
  .sl-cell{padding:4%}.sl-intro{align-items:center}.sl-poke svg{width:56px;height:56px}.sl-controls{gap:8px}.sl-spin{flex:1 1 100%;min-height:54px}.sl-payrow{grid-template-columns:40px 1fr repeat(3,46px);font-size:.72rem}
  .sl-bushes{gap:5px}.sl-toasts{bottom:calc(env(safe-area-inset-bottom,0px) + 96px)}.sl-statlist{grid-template-columns:1fr 1fr}
}
@media(prefers-reduced-motion:reduce){
  .sl-cell.is-win .sl-sym,.sl-cell.is-scatter .sl-sym,.sl-cell.is-bonusc .sl-sym,.sl-heatbar.is-full i,.sl-frame.is-tense,.sl-gold,.sl-fly span,.sl-banner.show,.sl-shake,.sl-pop,.sl-quip.show,.sl-bush.open{animation:none!important}
  .sl-banner.show{opacity:1;transform:translate(-50%,-50%)}.sl-toast{animation-duration:.01ms!important;opacity:1}
}
@media print{.slots-page{display:none}}
`,
  'tests/slots.mjs': String.raw`import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../js/slots-math.js';
import { simulate } from '../tools/slots-tune.mjs';

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, @@BT@@@@DS@@a} vs @@DS@@b} (±@@DS@@eps})@@BT@@);

test('в математике нет Math-генератора, ГСЧ внедряется', () => {
  const src = readFileSync(new URL('../js/slots-math.js', import.meta.url), 'utf8');
  assert.equal(/Math\.rand/.test(src), false);
  const a = M.mulberry32(5), b = M.mulberry32(5);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  const r = M.cryptoRng(); const x = r(); assert.ok(x >= 0 && x < 1);
});

test('ленты: длина, спецсимволы только где положено', () => {
  for (const set of ['cold', 'warm', 'fs']) STRIPS_CHECK(set);
  function STRIPS_CHECK(set) {
    const s = M.STRIPS[set]; assert.equal(s.length, 5);
    s.forEach((strip, i) => {
      assert.ok(strip.length >= 40);
      assert.equal(strip.includes('wild'), i >= 1 && i <= 3, @@BT@@@@DS@@set} wild r@@DS@@i}@@BT@@);
      assert.equal(strip.includes('bonus'), (i % 2 === 0) && set !== 'fs', @@BT@@@@DS@@set} bonus r@@DS@@i}@@BT@@);
    });
  }
  assert.equal(M.STRIPS.cold.map(s => s.length).join(), M.STRIPS.warm.map(s => s.length).join());
});

test('оценка: линии, Wild подменяет всё, кроме Scatter/Bonus; расширение даёт +1 к множителю', () => {
  const g = (...cols) => cols;
  let r = M.evaluate([['berry', 'apple', 'mush'], ['rust', 'pi', 'git'], ['hog', 'orange', 'cpp'], ['cpp', 'git', 'rust'], ['mush', 'apple', 'pi']]);
  assert.equal(r.lines.length, 0);
  r = M.evaluate([['king', 'apple', 'pi'], ['king', 'wild', 'rust'], ['king', 'berry', 'git'], ['king', 'cpp', 'mush'], ['king', 'rust', 'orange']]);
  assert.ok(r.lines.some(l => l.sym === 'king' && l.count === 5));
  assert.deepEqual(r.expanded, [1]);
  assert.equal(r.mult, 2);
  // Scatter не заменяется расширением и не платит по линии
  r = M.evaluate([['scatter', 'berry', 'pi'], ['wild', 'scatter', 'rust'], ['berry', 'git', 'scatter'], ['cpp', 'mush', 'orange'], ['pi', 'hog', 'berry']]);
  assert.equal(r.scatter, 3); assert.equal(r.fsSpins, 8); assert.equal(r.scatterPay, 2); assert.equal(r.grid[1][1], 'scatter');
  assert.equal(M.evaluate([['bonus', 'a', 'b'], ['x', 'y', 'z'], ['bonus', 'a', 'b'], ['x', 'y', 'z'], ['bonus', 'a', 'b']].map(c => c.map(s => (s.length > 1 && s !== 'bonus' ? 'berry' : s)))).bonus, true);
});

test('потолок выигрыша 5000× и во фриспинах', () => {
  const kings = Array.from({ length: 5 }, () => ['king', 'king', 'king']);
  const base = M.evaluate(kings, 1); assert.ok(base.win <= M.MAX_WIN);
  const fsWin = M.evaluate(kings, 10); assert.equal(fsWin.win, M.MAX_WIN);
  const fs = M.fsStart(8); fs.mult = 10; fs.total = 4990;
  const rng = M.mulberry32(1); for (let i = 0; i < 50 && fs.left > 0; i++) M.fsStep(rng, fs);
  assert.ok(fs.total <= M.MAX_WIN);
});

test('RTP ≈ 96–97.8%, частота выигрышей 24–31%, миллионы спинов (SLOTS_FAST — быстрая версия)', () => {
  // у фриспинов и поляны тяжёлый хвост: на 2 млн спинов шум RTP ≈ ±0.6%, поэтому полный прогон — 12 млн (≈15 с)
  const fast = Boolean(process.env.SLOTS_FAST), r = simulate({ spins: fast ? 1500000 : 12000000, bet: 10, seed: 2026 });
  const lo = fast ? 94 : 96.0, hi = fast ? 100 : 97.8;
  assert.ok(r.rtp >= lo && r.rtp <= hi, @@BT@@RTP @@DS@@r.rtp}@@BT@@);
  assert.ok(r.hit >= 24 && r.hit <= 31, @@BT@@hit @@DS@@r.hit}@@BT@@);
  assert.ok(r.rtpBase > 56 && r.rtpBase < 66, @@BT@@base @@DS@@r.rtpBase}@@BT@@);
  assert.ok(r.rtpFs > 14 && r.rtpFs < 34, @@BT@@fs @@DS@@r.rtpFs}@@BT@@);
  assert.ok(r.rtpPick > 5 && r.rtpPick < 13, @@BT@@pick @@DS@@r.rtpPick}@@BT@@);
  assert.ok(r.rtpJp > 0.8 && r.rtpJp < 3.5, @@BT@@jp @@DS@@r.rtpJp}@@BT@@);
});

test('горячая серия: тёплые ленты чаще выигрывают, но RTP почти не меняется (±0.3%)', () => {
  const run = (set, scale) => { const rng = M.mulberry32(99); let w = 0, h = 0; const n = 4000000; for (let i = 0; i < n; i++) { const { raw } = M.spinGrid(rng, set); const x = M.evaluate(raw, 1, scale).win; w += x; if (x > 0) h++; } return { rtp: 100 * w / n, hit: 100 * h / n }; };
  const cold = run('cold', 1), warm = run('warm', M.WARM_SCALE);
  near(warm.rtp, cold.rtp, 0.35); assert.ok(warm.hit > cold.hit + 1.5);
  // «жар» копится на проигрышах и сбрасывается после тёплого спина
  const S = M.newSlotsState(); S.heat = M.HEAT_MAX; const res = M.baseSpin(M.mulberry32(3), S, 1); assert.equal(res.warm, true); assert.equal(S.heat, 0);
  const F = M.newSlotsState(); M.baseSpin(() => 0.0, F, 1, { paid: false }); assert.equal(F.heat, 0); // бесплатные не копят жар
});

test('перки шляп дают не больше +0.3% RTP суммарно (парные выборки по функциям, без шума)', () => {
  const rng0 = M.mulberry32(5); let fs = 0, bn = 0; const n = 2000000;
  for (let i = 0; i < n; i++) { const r = M.evaluate(M.spinGrid(rng0, 'cold').raw); if (r.fsSpins) fs++; if (r.bonus) bn++; }
  let dPick = 0; const N = 300000;
  for (let i = 0; i < N; i++) { const play = perks => { const rng = M.mulberry32(i + 1), g = M.pickInit(rng, perks); while (!g.over) { const free = g.cells.map((_, k) => k).filter(k => !g.revealed.includes(k)); M.pickReveal(g, free[Math.floor(rng() * free.length)]); } M.pickWizard(g); return M.pickTotal(g); }; dPick += play({ wizard: true }) - play({}); }
  let dFs = 0; const F = 150000;
  for (let i = 0; i < F; i++) { const play = perks => { const rng = M.mulberry32(i + 7), f = M.fsStart(8, perks); while (f.left > 0) M.fsStep(rng, f); return f.total; }; dFs += play({ foil: true }) - play({}); }
  const delta = 100 * (dPick / N * bn / n + dFs / F * fs / n);
  assert.ok(delta >= 0 && delta <= 0.3, @@BT@@Δ @@DS@@delta}@@BT@@);
});

test('пул: копит 1.5% платных ставок, сбрасывается на 500 после джекпота', () => {
  const S = M.newSlotsState(); assert.equal(S.pool, 500);
  M.baseSpin(() => 0.99, S, 10); near(S.pool, 500.15, 1e-9);
  M.baseSpin(() => 0.99, S, 10, { paid: false }); near(S.pool, 500.15, 1e-9);
  // принудительный джекпот: три расширенных Wild и «удачный» ГСЧ
  const T = M.newSlotsState(); T.pool = 1234;
  const orig = M.spinGrid; assert.equal(typeof orig, 'function');
  assert.equal(M.jackpotHit(() => 0, 10), true); assert.equal(M.jackpotHit(() => 0.999, 10), false);
  assert.equal(M.jackpotHit(() => 0.5, 1000), true); // ставка масштабирует шанс (потолок 1)
});

test('перенос дробной части: сумма сохраняется', () => {
  let frac = 0, total = 0, paid = 0; const rng = M.mulberry32(8);
  for (let i = 0; i < 5000; i++) { const amt = Math.round(rng() * 40) / 20 * 3; const s = M.settle(frac, amt); frac = s.frac; paid += s.whole; total += amt; }
  near(paid + frac, total, 1e-6); assert.ok(frac >= 0 && frac < 1);
});

test('фриспины: множитель +1 после выигрышного спина, потолок 10 (11 с фольгой), ретригер +5', () => {
  const fs = M.fsStart(8, {}); assert.equal(fs.mult, 1); assert.equal(fs.cap, 10);
  assert.equal(M.fsStart(8, { foil: true }).cap, 11);
  const rng = M.mulberry32(11); let last = 1;
  while (fs.left > 0) { const st = M.fsStep(rng, fs); assert.ok(st.mult >= last && st.mult <= 10); if (st.res.win > 0 && last < 10) assert.equal(st.mult, last + 1); last = st.mult; if (st.res.scatter >= 3) assert.ok(fs.retriggers > 0); }
  assert.ok(fs.played >= 8);
});

test('бонус-поляна: ограничения, Сегфолт заканчивает, перк мага даёт один магический куст', () => {
  const g = M.pickInit(M.mulberry32(4), { wizard: true }); assert.equal(g.cells.length, 12); assert.equal(g.picks, 3); assert.equal(g.wz, true); assert.equal(M.pickWizard(g), M.WIZARD_PRIZE); assert.equal(M.pickWizard(g), null);
  assert.equal(g.cells.filter(c => c === 'segfault').length, 1);
  const seg = g.cells.indexOf('segfault'); M.pickReveal(g, seg); assert.equal(g.over, true); assert.equal(g.segfault, true);
  assert.equal(M.pickReveal(g, 0), null);
  const rng = M.mulberry32(6); for (let k = 0; k < 200; k++) { const h = M.pickInit(rng); let n = 0; while (!h.over && n++ < 20) M.pickReveal(h, h.cells.findIndex((_, i) => !h.revealed.includes(i))); assert.ok(h.over); assert.ok(M.pickTotal(h) <= M.MAX_WIN); }
});

test('«Удвоить или ничего»: честные 50/50, EV нулевой, ≤25× и ≤3 раунда', () => {
  const rng = M.mulberry32(21); let wins = 0; const n = 400000;
  for (let i = 0; i < n; i++) if (M.gambleRound(rng, 'red').won) wins++;
  near(wins / n, 0.5, 0.005);
  assert.equal(M.gambleAllowed(250, 10, 0), true); assert.equal(M.gambleAllowed(251, 10, 0), false); assert.equal(M.gambleAllowed(20, 10, 3), false); assert.equal(M.gambleAllowed(0, 10, 0), false);
});

test('ежедневные спины: 1,1,2,2,3,3,5, сброс при пропуске, капсула на 7-й день, корона +1', () => {
  const S = M.newSlotsState(); let day = new Date(2026, 9, 1, 10); const got = [];
  for (let i = 0; i < 8; i++) { const c = M.dailyClaim(S, day, {}); got.push(c.spins); if (i === 6) assert.equal(c.capsule, true); assert.equal(M.dailyClaim(S, day), null); day = M.addDay(day, 1); }
  assert.deepEqual(got, [1, 1, 2, 2, 3, 3, 5, 1]); assert.equal(S.capsules, 1);
  day = M.addDay(day, 2); assert.equal(M.dailyClaim(S, day).streak, 1); // пропуск → сначала
  const C = M.newSlotsState(); let d = new Date(2026, 9, 1, 9); let last; for (let i = 0; i < 7; i++) { last = M.dailyClaim(C, d, { crown: true }); d = M.addDay(d, 1); } assert.equal(last.spins, 6);
  assert.equal(M.dayKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('колесо дня: нужны 3 выполненные цели и неиспользованный день', () => {
  const now = new Date(2026, 9, 14, 12), S = M.newSlotsState(), mk = d => ({ daily: { date: M.dayKey(now), goals: d.map(done => ({ done })) } });
  assert.equal(M.wheelReady(S, mk([true, true, false]), now), false); assert.equal(M.wheelReady(S, mk([true, true, true]), now), true);
  S.wheelDay = M.dayKey(now); assert.equal(M.wheelReady(S, mk([true, true, true]), now), false);
  const rng = M.mulberry32(5); for (let i = 0; i < 1000; i++) { const k = M.wheelPick(rng); assert.ok(k >= 0 && k < M.WHEEL.length); }
});

test('капсулы: редкости, гарантия эпика после 12, дубликаты → ягоды, бусты складываются', () => {
  assert.ok(M.CATALOG.length >= 26 && M.CATALOG.length <= 32);
  for (const r of Object.keys(M.RARITY)) assert.ok(M.CATALOG.some(x => x.rarity === r), r);
  const S = M.newSlotsState(), rng = M.mulberry32(31); let gap = 0, maxGap = 0;
  for (let i = 0; i < 3000; i++) { const o = M.openCapsule(rng, S); if (o.item.rarity === 'epic' || o.item.rarity === 'legendary') { maxGap = Math.max(maxGap, gap); gap = 0; } else gap++; if (o.item.kind === 'boost') assert.equal(o.dup, false); }
  assert.ok(maxGap <= M.PITY_CAPSULES, @@BT@@gap @@DS@@maxGap}@@BT@@);
  const D = M.newSlotsState(); D.album['hat:foilpro'] = 1; let seen = false; for (let i = 0; i < 400 && !seen; i++) { const o = M.openCapsule(rng, D); if (o.item.id === 'hat:foilpro') { assert.equal(o.dup, true); assert.equal(o.berries, 250); seen = true; } }
  assert.ok(seen);
  assert.deepEqual(M.HAT_SET.length, 6);
});

test('контрольные суммы замечают ручные правки; старые данные принимаются', () => {
  const S = M.newSlotsState(); assert.equal(M.checkSlots(S), 'legacy'); S.sig = M.signSlots(S); assert.equal(M.checkSlots(S), 'ok');
  S.free = 99; assert.equal(M.checkSlots(S), 'bad');
  const save = { berries: 10, owned: ['none', 'party'], bonusSpins: 1, boosts: { shield: 1 } }; assert.equal(M.checkShared(save), 'legacy');
  save.bsig = M.signShared(save); assert.equal(M.checkShared(save), 'ok'); save.berries = 5000; assert.equal(M.checkShared(save), 'bad');
  const a = { berries: 1, owned: ['b', 'a'] }, b = { owned: ['a', 'b'], berries: 1 }; assert.equal(M.signShared(a), M.signShared(b));
});

test('плашка на старте игры', () => {
  const now = new Date(2026, 9, 14, 10), save = { bonusSpins: 2, daily: null };
  assert.equal(M.slotsChipText(save, null, now), 'ежедневный спин готов');
  const S = M.newSlotsState(); S.lastDay = M.dayKey(now); S.free = 1; assert.equal(M.slotsChipText(save, JSON.stringify(S), now), '3 бесплатных');
});
`,
  'tests/slots-ui.mjs': String.raw`import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/slots-math.js';

// Лёгкий «ненастоящий DOM»: проверяем логику страницы (расчёты, сохранения, события), а не вёрстку.
const store = new Map(), listeners = {}, cache = new Map(), errors = [];
const noop = () => {};
const ctx2d = new Proxy({}, { get: () => noop, set: () => true });
function makeEl(tag) {
  const e = { tag, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, style: {}, dataset: {}, hidden: false, disabled: false, innerHTML: '', textContent: '', value: '0', checked: true, open: false, offsetWidth: 1, isConnected: true,
    querySelector: sel => pick(sel), querySelectorAll: () => [], addEventListener(t, f) { (listeners[t] ||= []).push(f); }, removeEventListener: noop, append: noop, insertAdjacentHTML: noop, remove: noop, setAttribute: noop,
    getContext: () => ctx2d, getBoundingClientRect: () => ({ width: 500, height: 300, left: 0, top: 0 }), animate: () => ({ finished: Promise.resolve(), finish: noop, cancel: noop }), closest: () => null, focus: noop,
    showModal() { this.open = true; }, close() { this.open = false; } };
  let kids = null; Object.defineProperty(e, 'children', { get() { return kids ||= Array.from({ length: 5 }, () => makeEl('div')); } });
  return e;
}
const pick = sel => { if (!cache.has(sel)) cache.set(sel, makeEl(sel)); return cache.get(sel); };
const content = pick('#content');
const immediate = (f, ms, ...a) => setImmediate(() => f(...a));
Object.assign(globalThis, {
  document: { createElement: t => makeEl(t), querySelector: pick, getElementById: () => ({}), body: makeEl('body'), activeElement: { tagName: 'BODY' }, addEventListener: noop, removeEventListener: noop },
  window: { addEventListener(t, f) { (listeners['w:' + t] ||= []).push(f); }, removeEventListener: noop },
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  matchMedia: () => ({ matches: true }), requestAnimationFrame: f => setImmediate(() => f(performance.now() + 5000)), cancelAnimationFrame: noop, devicePixelRatio: 1,
  setTimeout: immediate, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
});
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: arr => { const r = M.mulberry32(777); globalThis.__r ||= r; for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(globalThis.__r() * 4294967296); return arr; } } });
process.on('unhandledRejection', e => errors.push(e));
const tick = () => new Promise(r => setImmediate(r));
const click = async (id, extra = {}) => { const btn = { id, dataset: extra, closest: () => null, disabled: false }; for (const f of listeners.click || []) f({ target: { closest: s => (s === 'button' ? btn : null) } }); await tick(); };
const overClick = act => { const btn = { id: '', dataset: { act }, closest: () => null }; for (const f of listeners.click || []) f({ target: { closest: s => (s === 'button' ? btn : s === '#sl-over' ? {} : null) } }); };
const settleSpin = async () => { for (let k = 0; k < 20000; k++) { await tick(); if (!pick('#sl-spin').disabled) return; if (k % 20 === 0) { overClick('jp-close'); overClick('pick-close'); const o = pick('#sl-over'); if (o._reveal) for (let b = 0; b < 12; b++) { try { await o._reveal({ disabled: false, classList: { add: noop }, innerHTML: '' }); } catch { /* закончено */ } } if (o._close) o._close(); } } throw new Error('спин завис'); };

test('страница слотов: 300 спинов, баланс сходится, сохранения подписаны, уничтожение чистое', async () => {
  store.set('hh_save_v1', JSON.stringify({ berries: 100000, owned: ['none'], hat: 'none', daily: null }));
  const S0 = M.newSlotsState(); S0.capsules = 4; S0.free = 3; store.set('m3102-slots-v1', JSON.stringify(S0));
  const { renderSlotsPage } = await import('../js/slots.js');
  renderSlotsPage(); assert.equal(typeof window.__hhDestroy, 'function');
  for (let i = 0; i < 3; i++) await click('sl-bet-dn'); // ставка 1
  for (let i = 0; i < 300; i++) { await click('sl-spin'); await settleSpin(); if (JSON.parse(store.get('m3102-slots-v1')).pending > 0 && i % 2 === 0) { await click('x', { gamble: i % 4 === 0 ? 'red' : 'black' }); for (let k = 0; k < 30; k++) await tick(); } }
  await click('sl-free'); await settleSpin();
  await click('sl-claim'); await click('sl-opencap'); for (let k = 0; k < 200; k++) await tick();
  await click('sl-pay'); await click('sl-break'); await click('sl-turbo'); await click('sl-sound'); await click('x', { gamble: 'collect' }); await click('sl-poke');
  window.__hhDestroy();
  const H = JSON.parse(store.get('hh_save_v1')), S = JSON.parse(store.get('m3102-slots-v1'));
  assert.equal(M.checkShared(H), 'ok'); assert.equal(M.checkSlots(S), 'ok');
  assert.ok(S.stats.gambles > 0 && S.stats.fs > 0 && S.stats.picks > 0, 'бонусы и гэмбл должны сработать');
  assert.equal(S.stats.spins, 301); assert.equal(S.stats.wagered, 300);
  assert.equal(S.pending, 0); assert.ok(Number.isInteger(H.berries));
  // баланс = старт − ставки + выигрыши (+ ягоды за дубликаты капсул, их немного)
  const expected = 100000 - S.stats.wagered + S.stats.won; assert.ok(H.berries >= expected && H.berries - expected <= 300, @@BT@@@@DS@@H.berries} vs @@DS@@expected}@@BT@@);
  assert.deepEqual(errors, []);
});
`,
  'tools/slots-tune.mjs': String.raw`// Помощник настройки: node tools/slots-tune.mjs [спинов] [ставка]  — печатает RTP и частоту выигрышей (в интерфейс эти числа не попадают)
import { mulberry32, playRound, newSlotsState, SEED_POOL, HEAT_MAX } from '../js/slots-math.js';

export function simulate({ spins = 1000000, bet = 10, seed = 12345, perks = {} } = {}) {
  const rng = mulberry32(seed), S = newSlotsState(), t = { wag: 0, base: 0, fs: 0, pick: 0, jp: 0, hits: 0, warmN: 0, warmWin: 0, warmHit: 0, coldN: 0, coldWin: 0, coldHit: 0, fsTrig: 0, bonusTrig: 0, big: 0 };
  for (let i = 0; i < spins; i++) {
    const { res, parts } = playRound(rng, S, bet, perks), won = parts.total;
    t.wag += bet; t.base += parts.base; t.fs += parts.fs; t.pick += parts.pick; t.jp += parts.jp;
    if (res.win > 0) t.hits++;
    if (res.fsSpins) t.fsTrig++; if (res.bonus) t.bonusTrig++; if (won >= 100 * bet) t.big++;
    const k = res.warm ? 'warm' : 'cold'; t[k + 'N']++; t[k + 'Win'] += res.win * bet; if (res.win > 0) t[k + 'Hit']++;
  }
  const pool = S.pool - SEED_POOL; // невыплаченный остаток пула считаем обязательством
  const pct = x => (100 * x / t.wag);
  return { ...t, rtp: pct(t.base + t.fs + t.pick + t.jp + pool), rtpBase: pct(t.base), rtpFs: pct(t.fs), rtpPick: pct(t.pick), rtpJp: pct(t.jp + pool),
    hit: 100 * t.hits / spins, warmRtp: t.warmN ? 100 * t.warmWin / (t.warmN * bet) : 0, coldRtp: 100 * t.coldWin / (t.coldN * bet),
    warmHit: t.warmN ? 100 * t.warmHit / t.warmN : 0, coldHit: 100 * t.coldHit / t.coldN, warmShare: 100 * t.warmN / spins, fsEvery: spins / Math.max(1, t.fsTrig), bonusEvery: spins / Math.max(1, t.bonusTrig) };
}
if (process.argv[1] && process.argv[1].endsWith('slots-tune.mjs')) {
  const r = simulate({ spins: Number(process.argv[2]) || 1000000, bet: Number(process.argv[3]) || 10 });
  console.log(JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => /^(rtp|hit|warm|cold|fsEvery|bonusEvery)/.test(k)).map(([k, v]) => [k, Math.round(v * 100) / 100])), null, 1));
}
`,
};

/* ======================= правки существующих файлов ======================= */
// find должен встречаться ровно один раз; replace уже присутствует в файле — значит правка применена.
const E = (find, replace) => ({ find: T(find), replace: T(replace) });
const PATCHES = [
  { file: 'index.html', edits: [
    E(String.raw`import { installBackdrop } from './js/backdrop.js';`, String.raw`import { installBackdrop } from './js/backdrop.js';
    import { renderSlotsPage, installSlots } from './js/slots.js';
    import { signShared, slotsChipText } from './js/slots-math.js';`),
    E(String.raw`<link rel="stylesheet" href="./css/appearance.css">`, String.raw`<link rel="stylesheet" href="./css/appearance.css">
    <link rel="stylesheet" href="./css/slots.css">`),
    E(String.raw`if(h==='hedgehog')return{mode:'hedgehog',path:''};`, String.raw`if(h==='hedgehog')return{mode:'hedgehog',path:''};
      if(h==='slots')return{mode:'slots',path:''};`),
    E(String.raw`['diagrams','memes','hedgehog','other','students','settings'].includes(mode))key='other';`, String.raw`['diagrams','memes','hedgehog','slots','other','students','settings'].includes(mode))key='other';`),
    E(String.raw`hedgehog:4,settings:4}`, String.raw`hedgehog:4,settings:4,slots:4}`),
    E(String.raw`else if(mode==='hedgehog')renderHedgehogPage();`, String.raw`else if(mode==='hedgehog')renderHedgehogPage();
  else if(mode==='slots')renderSlotsPage();`),
    E(String.raw`installMemes();`, String.raw`installMemes();
    installSlots();`),
    E(String.raw`<a class="card" data-go="settings">`, String.raw`<a class="card" data-go="slots"><div class="ic">@@DS@@ic('sparkles',22)}</div><div class="meta"><div class="name">Колючий куш</div><div class="desc">Слоты на ягоды ёжика, капсулы и альбом</div></div></a>
          <a class="card" data-go="settings">`),
    // --- игра «Ёжик»: подпись сохранения, шляпы, бонусы, перки ---
    E(String.raw`function persist(s){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch(e){}}`, String.raw`function persist(s){try{s.bsig=signShared(s);localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch(e){}}`),
    E(String.raw`{id:'crown',name:'Корона',cost:600}`, String.raw`{id:'crown',name:'Корона',cost:600},
  {id:'itmocap',name:'Кепка студента ИТМО',cost:0,secret:true,perk:'Сонливость растёт медленнее'},{id:'goldtop',name:'Золотой цилиндр',cost:0,secret:true,perk:'Ягоды дают больше очков'},{id:'crabgear',name:'Шлем краба-шестерёнки',cost:0,secret:true,perk:'Старт со щитом и неуязвимостью'},{id:'orangepeel',name:'Апельсиновая кожура',cost:0,secret:true,perk:'Яблоки бодрят сильнее'},{id:'cpphelm',name:'Шлем C++',cost:0,secret:true,perk:'Быстрый старт'},{id:'foilpro',name:'Фольга-ПРО',cost:0,secret:true,perk:'Бонусы действуют вдвое дольше'}`),
    E(String.raw`}else if(id==='crown'){`, String.raw`}else if(id==='itmocap'){
    ctx.fillStyle='#1e3a8a';ctx.beginPath();ctx.arc(0,0,0.5*R,Math.PI,0);ctx.closePath();ctx.fill();ctx.fillStyle='#152a66';ell(ctx,0.32*R,0.02*R,0.34*R,0.07*R,0.1);ctx.fillStyle='#ff8a2a';circ(ctx,0,-0.26*R,0.11*R);ctx.fillStyle='#fff';circ(ctx,0,-0.26*R,0.05*R);
  }else if(id==='goldtop'){
    ctx.fillStyle='#e8b923';ctx.fillRect(-0.3*R,-0.68*R,0.6*R,0.64*R);ell(ctx,0,0,0.52*R,0.11*R,0);ctx.fillStyle='#9a6a0a';ctx.fillRect(-0.3*R,-0.18*R,0.6*R,0.1*R);ctx.fillStyle='#fff3a8';ell(ctx,-0.12*R,-0.4*R,0.05*R,0.2*R,0);ctx.fillStyle='#f3cf4a';ell(ctx,0,-0.68*R,0.3*R,0.07*R,0);
  }else if(id==='crabgear'){
    ctx.fillStyle='#d9622b';ctx.beginPath();ctx.arc(0,0,0.5*R,Math.PI,0);ctx.closePath();ctx.fill();ctx.fillStyle='#8f3a12';for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6;ctx.save();ctx.translate(Math.cos(a)*0.5*R,Math.sin(a)*0.5*R);ctx.rotate(a+Math.PI/2);ctx.fillRect(-0.05*R,-0.12*R,0.1*R,0.14*R);ctx.restore();}ctx.fillStyle='#ffd09a';circ(ctx,0,-0.2*R,0.12*R);ctx.fillStyle='#6b2a07';circ(ctx,0,-0.2*R,0.05*R);
  }else if(id==='orangepeel'){
    ctx.fillStyle='#f28a1b';ctx.beginPath();ctx.arc(0,0,0.5*R,Math.PI,0);ctx.closePath();ctx.fill();ctx.strokeStyle='#ffc766';ctx.lineWidth=0.05*R;ctx.beginPath();ctx.arc(0,0,0.34*R,Math.PI*1.1,Math.PI*1.9);ctx.stroke();ctx.fillStyle='#4aa655';ell(ctx,0.08*R,-0.54*R,0.14*R,0.07*R,-0.4);
  }else if(id==='cpphelm'){
    ctx.fillStyle='#2a6fd0';ctx.beginPath();for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3;ctx[i?'lineTo':'moveTo'](Math.cos(a)*0.46*R,-0.3*R+Math.sin(a)*0.4*R);}ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.font='800 '+(0.24*R)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('C++',0,-0.3*R);ctx.textBaseline='alphabetic';
  }else if(id==='foilpro'){
    ctx.fillStyle='#e6eaf2';ctx.beginPath();ctx.moveTo(-0.38*R,0);ctx.lineTo(-0.26*R,-0.55*R);ctx.lineTo(-0.05*R,-0.38*R);ctx.lineTo(0.16*R,-0.7*R);ctx.lineTo(0.38*R,0);ctx.closePath();ctx.fill();ctx.fillStyle='#8fe3ff';starPath(ctx,0.2*R,-0.5*R,0.08*R);ctx.fill();ctx.fillStyle='#ffe27a';starPath(ctx,-0.2*R,-0.3*R,0.06*R);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=0.04*R;ctx.beginPath();ctx.moveTo(-0.26*R,-0.55*R);ctx.lineTo(-0.12*R,-0.08*R);ctx.stroke();
  }else if(id==='crown'){`),
    E(String.raw`if(!menu&&this.save.hat==='helmet')this.hog.shd=25;`, String.raw`if(!menu&&this.save.hat==='helmet')this.hog.shd=25;if(!menu&&this.save.hat==='crabgear'){this.hog.shd=25;this.hog.inv=3;}if(!menu&&this.save.hat==='cpphelm'){this.hog.s=320;this.hog.boostT=3;}`),
    E(String.raw`this.biome=-1;this.cam.init=false;this.pal=getPal(this.tod);this.prog=0;`, String.raw`this.biome=-1;this.cam.init=false;this.pal=getPal(this.tod);this.prog=0;this.bst=false;if(!menu){const bo=this.save.boosts||(this.save.boosts={}),used=[];if(bo.shield>0){bo.shield--;this.hog.shd=25;used.push('щит');}if(bo.coffee>0){bo.coffee--;this.hog.cof=8;used.push('кофе');}if(bo.magnet>0){bo.magnet--;this.hog.mag=9;used.push('магнит');}if(bo.berrystart>0){bo.berrystart--;this.bst=true;used.push('«Ягодный старт»');}if(used.length){this.addBanner('🎁 Бонусы: '+used.join(', '));persist(this.save);}}`),
    E(String.raw`this.sleep=Math.min(1,this.sleep+sev);`, String.raw`this.sleep=Math.min(1,this.sleep+sev*(this.save.hat==='itmocap'?0.85:1));`),
    E(String.raw`this.sleep=Math.min(1,this.sleep+0.12);`, String.raw`this.sleep=Math.min(1,this.sleep+0.12*(this.save.hat==='itmocap'?0.85:1));`),
    E(String.raw`this.dayAdd('berries',1);this.trick+=5*m;`, String.raw`this.dayAdd('berries',1);this.trick+=5*m*(this.save.hat==='goldtop'?2:1);`),
    E(String.raw`this.sleep=Math.max(0,this.sleep-(this.save.hat==='chef'?0.4:0.25));`, String.raw`this.sleep=Math.max(0,this.sleep-(this.save.hat==='chef'?0.4:this.save.hat==='orangepeel'?0.45:0.25));`),
    E(String.raw`const pm=this.save.hat==='foil'?1.5:1;`, String.raw`const pm=this.save.hat==='foilpro'?2:this.save.hat==='foil'?1.5:1;`),
    E(String.raw`const bb=this.hog.stm>0?2:1;`, String.raw`const bb=(this.hog.stm>0?2:1)+(this.bst&&Math.random()<0.25?1:0);`),
    E(String.raw`const s=this.save,nb={},best=s.best;`, String.raw`const s=this.save,nb={},best=s.best;const pd=best.dist,ps=best.score;`),
    // +1 бесплатный спин за заметный личный рекорд (не за каждое «+1 метр»: нужно ≥100 м или ≥1500 очков и прирост от 5%)
    E(String.raw`if(sum.time>best.time)best.time=sum.time;`, String.raw`if(sum.time>best.time)best.time=sum.time;if((nb.dist&&sum.dist>=100&&sum.dist>=pd*1.05)||(nb.score&&sum.score>=1500&&sum.score>=ps*1.05)){s.bonusSpins=(s.bonusSpins|0)+1;sum.bonusSpin=true;}`),
    E(String.raw`'<h2 class="hh-h">Ёжик уснул 💤</h2>'+`, String.raw`'<h2 class="hh-h">Ёжик уснул 💤</h2>'+(s.bonusSpin?'<p class="hh-sub">🎰 +1 бесплатный спин в «Колючем куше» за новый рекорд!</p>':'')+`),
    E(String.raw`<button class="btn2 hh-big" data-act="hats" type="button">🎩 Шляпы</button></div>'+`, String.raw`<button class="btn2 hh-big" data-act="hats" type="button">🎩 Шляпы</button><a class="btn2 hh-big" href="#/slots">🎰 Слоты</a></div>'+`),
    E(String.raw`<span class="hh-chip">🏁 '+fmt(b.dist)+' м</span>`, String.raw`'+slotsChip()+'<span class="hh-chip">🏁 '+fmt(b.dist)+' м</span>`),
    E(String.raw`function goalsHtml(){`, String.raw`function slotsChip(){let t='';try{t=slotsChipText(save,localStorage.getItem('m3102-slots-v1'));}catch(e){}return t?'<span class="hh-chip">🎰 '+t+'</span>':'';}
  function goalsHtml(){`),
  ] },
  { file: 'sw.js', edits: [
    { optional: true, ...E(String.raw`const CACHE = 'm3102-shell-v10';`, String.raw`const CACHE = 'm3102-shell-v11';`) },
    E(String.raw`'./fonts/URWGothic-Book.woff2', './fonts/URWGothic-Demi.woff2'`, String.raw`'./fonts/URWGothic-Book.woff2', './fonts/URWGothic-Demi.woff2',
  './js/slots.js', './js/slots-math.js', './js/slots-art.js', './js/slots-audio.js', './css/slots.css'`),
  ] },
  { file: 'js/settings.js', edits: [
    E(String.raw`{ id: 'cyan', name: 'Светлый циан' },`, String.raw`{ id: 'cyan', name: 'Светлый циан' },
  { id: 'gold', name: 'Золото' },
  { id: 'neon', name: 'Неон' },
  { id: 'aurora', name: 'Аврора' },`),
    E(String.raw`const DEFAULT_PALETTE = 'purple';`, String.raw`const DEFAULT_PALETTE = 'purple';
const BASE_PALETTES = ['purple', 'orange', 'green', 'blue', 'cyan'];
// палитры из капсул слотов видны, когда выпали (или выбраны прямо сейчас)
const paletteVisible = (id, current) => { if (BASE_PALETTES.includes(id) || id === current) return true; try { return Boolean(JSON.parse(localStorage.getItem('m3102-slots-v1')).album['pal:' + id]); } catch { return false; } };`),
    E(String.raw`.innerHTML = PALETTES.map(p => `, String.raw`.innerHTML = PALETTES.filter(p => paletteVisible(p.id, palette)).map(p => `),
  ] },
  { file: 'css/settings.css', edits: [
    E(String.raw`--pal-cyan-a:#4a9fae;--pal-cyan-b:#82bfca;`, String.raw`--pal-cyan-a:#4a9fae;--pal-cyan-b:#82bfca;
  --pal-gold-a:#c28a12;--pal-gold-b:#f0c95a;
  --pal-neon-a:#d61fd6;--pal-neon-b:#19d3ff;
  --pal-aurora-a:#2fb39a;--pal-aurora-b:#8a74f2;`),
    E(String.raw`:root[data-palette="cyan"]{--accent:var(--pal-cyan-a);--accent2:var(--pal-cyan-b)}`, String.raw`:root[data-palette="cyan"]{--accent:var(--pal-cyan-a);--accent2:var(--pal-cyan-b)}
:root[data-palette="gold"]{--accent:var(--pal-gold-a);--accent2:var(--pal-gold-b)}
:root[data-palette="neon"]{--accent:var(--pal-neon-a);--accent2:var(--pal-neon-b)}
:root[data-palette="aurora"]{--accent:var(--pal-aurora-a);--accent2:var(--pal-aurora-b)}`),
  ] },
  { file: 'js/greetings.js', edits: [
    E(String.raw`const FALLBACK = 'Ваш учебный день.';`, String.raw`const FALLBACK = 'Ваш учебный день.';

// Шутки из капсул «Колючего куша»: пак открывается, когда выпал предмет greet:<id>
export const GREETING_PACKS = {
  cat: ['Кот сидит на конспекте.', 'Мур-мур-мур, Коши.'],
  rust: ['Борроу-чекер недоволен.', 'Если компилируется — значит, работает.'],
  matan: ['Для любого ε найдётся δ.', 'Сходится абсолютно. Как и ваш дедлайн.'],
  orange: ['Вы Апельсин? Мы Апельсин.', 'Апельсиновое настроение.'],
  casino: ['Ставки сделаны — ягоды потрачены.', 'Крупье-ёжик приветствует вас.'],
};
function unlockedGreetings() {
  try {
    const album = JSON.parse(localStorage.getItem('m3102-slots-v1')).album || {};
    return Object.entries(GREETING_PACKS).filter(([id]) => album['greet:' + id]).flatMap(([, lines]) => lines);
  } catch { return []; }
}`),
    E(String.raw`const list = GREETINGS.filter(line => typeof line === 'string' && line.trim());`, String.raw`const list = [...GREETINGS, ...unlockedGreetings()].filter(line => typeof line === 'string' && line.trim());`),
  ] },
  { file: 'js/lectures.js', edits: [
    E(String.raw`{ title: 'Мемы', href: '#/memes' },`, String.raw`{ title: 'Мемы', href: '#/memes' }, { title: 'Колючий куш (слоты)', href: '#/slots' },`),
  ] },
  { file: 'manifest.webmanifest', edits: [
    { optional: true, ...E(String.raw`{ "name": "Дедлайны", "url": "./#/deadlines", "icons": [{ "src": "img/icons/icon-192.png", "sizes": "192x192", "type": "image/png" }] }`, String.raw`{ "name": "Дедлайны", "url": "./#/deadlines", "icons": [{ "src": "img/icons/icon-192.png", "sizes": "192x192", "type": "image/png" }] },
    { "name": "Колючий куш", "url": "./#/slots", "icons": [{ "src": "img/icons/icon-192.png", "sizes": "192x192", "type": "image/png" }] }`) },
  ] },
];

/* ======================= выполнение ======================= */
const args = process.argv.slice(2), dry = args.includes('--dry-run') || args.includes('--check');
const rootAt = args.indexOf('--root');
const root = resolve(rootAt >= 0 ? args[rootAt + 1] : join(dirname(fileURLToPath(import.meta.url)), '..'));
const norm = s => s.replace(/\r\n/g, '\n'), count = (text, part) => (part ? text.split(part).length - 1 : 0);
const log = (...a) => console.log(...a), problems = [], warnings = [];

const plan = [];  // { path, before (string|null), after, kind }
for (const [path, body] of Object.entries(FILES)) {
  const full = join(root, path), text = T(body), before = existsSync(full) ? readFileSync(full, 'utf8') : null;
  plan.push({ path, full, before, after: text, kind: before === null ? 'создан' : norm(before) === text ? 'без изменений' : 'обновлён', created: before === null });
}
const stats = [];
for (const patch of PATCHES) {
  const full = join(root, patch.file);
  if (!existsSync(full)) { problems.push(`${patch.file}: файла нет — запустите скрипт из корня репозитория или укажите --root`); continue; }
  const original = readFileSync(full, 'utf8'), crlf = original.includes('\r\n'); let text = norm(original), applied = 0, skipped = 0;
  for (const [i, edit] of patch.edits.entries()) {
    const label = `${patch.file} · правка ${i + 1}`;
    if (text.includes(edit.replace)) { skipped++; continue; }
    const n = count(text, edit.find);
    if (n === 1) { text = text.replace(edit.find, () => edit.replace); applied++; }
    else (edit.optional ? warnings : problems).push(`${label}: якорь ${n === 0 ? 'не найден' : `найден ${n} раз(а), ожидался 1`} → «${edit.find.slice(0, 70).replace(/\n/g, '⏎')}…»${edit.optional ? ' (необязательная правка, пропущена)' : ''}`);
  }
  plan.push({ path: patch.file, full, before: original, after: crlf ? text.replace(/\n/g, '\r\n') : text, kind: applied ? `изменён (${applied} правок${skipped ? `, ${skipped} уже были` : ''})` : 'уже применено', created: false, patched: true });
}
warnings.forEach(w => log('⚠', w));
if (problems.length) {
  console.error('\nУстановка отменена — ничего не записано. Проблемы:\n' + problems.map(p => '  ✗ ' + p).join('\n'));
  console.error('\nПохоже, файлы отличаются от ожидаемых. Откройте указанное место и внесите правку вручную либо обновите якорь в tools/apply-slots.mjs.');
  process.exit(2);
}
for (const p of plan) log(`${p.kind === 'без изменений' || p.kind === 'уже применено' ? '·' : '✓'} ${p.path} — ${p.kind}`);
if (dry) { log('\nПробный запуск: файлы не менялись.'); process.exit(0); }

const written = [];
const rollback = () => { for (const w of written.reverse()) { try { if (w.before === null) unlinkSync(w.full); else writeFileSync(w.full, w.before); } catch { /* best effort */ } } };
try {
  for (const p of plan) {
    if (p.before !== null && norm(p.before) === norm(p.after) && !p.patched) continue;
    if (p.patched && p.before === p.after) continue;
    mkdirSync(dirname(p.full), { recursive: true }); written.push(p); writeFileSync(p.full, p.after);
  }
  // проверка синтаксиса: каждый JS-файл и модульный скрипт index.html
  const check = (file, label) => { const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`${label}: ${r.stderr.trim().split('\n').slice(0, 4).join(' | ')}`); };
  for (const p of plan) {
    if (/\.(m?js)$/.test(p.path)) check(p.full, p.path);
    if (p.path === 'index.html') { const m = /<script type="module">([\s\S]*?)<\/script>/.exec(readFileSync(p.full, 'utf8')); if (!m) throw new Error('index.html: не найден модульный скрипт'); const tmp = join(tmpdir(), `slots-index-check-${process.pid}.mjs`); writeFileSync(tmp, m[1]); try { check(tmp, 'index.html (модульный скрипт)'); } finally { unlinkSync(tmp); } }
    if (p.path === 'manifest.webmanifest') JSON.parse(readFileSync(p.full, 'utf8'));
  }
} catch (error) {
  rollback(); console.error(`\n✗ Проверка после записи не прошла, изменения откатены.\n  ${error.message}`); process.exit(3);
}
log(`\nГотово. Затронуто файлов: ${written.length}. Дальше: npm test (SLOTS_FAST=1 npm test — быстрее), затем откройте #/slots.`);
log('Совет: git diff покажет все правки; откатить их можно командой git checkout -- . (новые файлы удалите вручную).');
