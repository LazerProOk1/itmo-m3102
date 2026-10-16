// Помощник настройки: node tools/slots-tune.mjs [спинов] [ставка]  — печатает RTP и частоту выигрышей (в интерфейс эти числа не попадают)
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
