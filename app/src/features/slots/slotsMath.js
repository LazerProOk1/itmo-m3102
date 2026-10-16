// @ts-nocheck
/* Перенесено из js/slots-math.js сайта группы (автор — RedstoneLord) как есть; правки помечены «Правка поверх оригинала».
   Обновлять — копированием нового файла и повтором правок. */
/*
  «Колючий куш» — чистая математика слотов. Без DOM и без Math-генератора: ГСЧ внедряется (crypto или seed).
  Числа RTP/частоты существуют только здесь, в тестах и в tools/slots-tune.mjs — в интерфейсе их нет.
  Допуск по перкам шляп (≤ +0.3% RTP суммарно) проверяется в tests/slots.mjs.
*/
export const SEED_POOL = 500, POOL_RATE = 0.015, MAX_WIN = 5000, HEAT_MAX = 10, DAILY_BET = 5;
export const BETS = [1, 2, 3, 4, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 10000000, 100000000];
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
export const LINE_SCALE = 1.0344; // калибровка линейных выплат (см. tools/slots-tune.mjs)
export const COLUMN_SCALE = 1; // выплата за 3 одинаковых символа в одном барабане = PAY[символ][0] × COLUMN_SCALE (по вертикали)
export const SCATTER_PAY = { 3: 2, 4: 10, 5: 50 };
export const FS_SPINS = { 3: 8, 4: 12, 5: 20 }, FS_RETRIGGER = 5, FS_CAP = 10;
export const WARM_SCALE = 1.2; // компенсация: тёплые ленты выигрывают чаще, но RTP остаётся таким же
export const JP_COEF = 0.008; // шанс розыгрыша джекпота при 3 расширенных Wild = min(1, JP_COEF × ставка)
export const LOSS_X = 0.5; // выигрыш ≤ LOSS_X × ставки считается проигрышем (жар, множитель фриспинов, уровень празднования)

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
  // Вертикаль: три одинаковых символа в одном барабане (Wild заменяют; барабан только из Wild не платит)
  for (let r = 0; r < REELS; r++) {
    const col = grid[r]; let target = '', ok = col.every(isLine);
    for (const s of col) { if (!ok) break; if (s === 'wild') continue; if (!target) target = s; else if (s !== target) ok = false; }
    if (ok && target) { const pay = PAY[target][0] * COLUMN_SCALE * LINE_SCALE * scale; units += pay; lines.push({ line: -1, col: r, sym: target, count: 3, pay: pay / 20, cells: [0, 1, 2].map(row => [r, row]) }); }
  }
  lines.sort((x, y) => y.pay - x.pay);
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
  if (res.win > LOSS_X) fs.mult = Math.min(fs.cap, fs.mult + 1);
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
  if (paid) S.heat = warm ? 0 : (res.win > LOSS_X ? 0 : S.heat + 1);
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
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
export const winTier = x => (x >= 100 ? 'epic' : x >= 40 ? 'mega' : x >= 15 ? 'big' : x >= 5 ? 'good' : x > LOSS_X ? 'small' : 'none');
// плашка на старте игры «Ёжик»: сколько бесплатных спинов ждёт
export function slotsChipText(save, rawSlots, now = new Date()) {
  let S = null; try { S = rawSlots ? JSON.parse(rawSlots) : null; } catch { S = null; }
  const free = (save.bonusSpins | 0) + (S ? S.free | 0 : 0), daily = !S || S.lastDay !== dayKey(now);
  return daily ? 'ежедневный спин готов' : free > 0 ? `${free} бесплатных` : wheelReady(S || newSlotsState(), save, now) ? 'колесо заряжено' : '';
}
