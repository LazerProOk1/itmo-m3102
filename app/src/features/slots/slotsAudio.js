// @ts-nocheck
/* Перенесено из js/slots-audio.js сайта группы (автор — RedstoneLord) как есть; правки помечены «Правка поверх оригинала».
   Обновлять — копированием нового файла и повтором правок. */
/*
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
