import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../js/slots-math.js';
import { simulate } from '../tools/slots-tune.mjs';

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b} (±${eps})`);

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
      assert.equal(strip.includes('wild'), i >= 1 && i <= 3, `${set} wild r${i}`);
      assert.equal(strip.includes('bonus'), (i % 2 === 0) && set !== 'fs', `${set} bonus r${i}`);
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
  assert.ok(r.rtp >= lo && r.rtp <= hi, `RTP ${r.rtp}`);
  assert.ok(r.hit >= 24 && r.hit <= 31, `hit ${r.hit}`);
  assert.ok(r.rtpBase > 56 && r.rtpBase < 66, `base ${r.rtpBase}`);
  assert.ok(r.rtpFs > 14 && r.rtpFs < 34, `fs ${r.rtpFs}`);
  assert.ok(r.rtpPick > 5 && r.rtpPick < 13, `pick ${r.rtpPick}`);
  assert.ok(r.rtpJp > 0.8 && r.rtpJp < 3.5, `jp ${r.rtpJp}`);
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
  assert.ok(delta >= 0 && delta <= 0.3, `Δ ${delta}`);
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
  assert.ok(maxGap <= M.PITY_CAPSULES, `gap ${maxGap}`);
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
