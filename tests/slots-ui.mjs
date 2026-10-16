import test from 'node:test';
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
  const expected = 100000 - S.stats.wagered + S.stats.won; assert.ok(H.berries >= expected && H.berries - expected <= 300, `${H.berries} vs ${expected}`);
  assert.deepEqual(errors, []);
});
