// @ts-nocheck — перенесённый JS группы без типов
import { describe, expect, it } from 'vitest';
import * as M from './slotsMath.js';

/** Быстрая проверка математики слотов, перенесённой у группы; тяжёлые прогоны RTP на миллионы спинов — в их tests/slots.mjs */
describe('slotsMath', () => {
  it('ГСЧ внедряется и повторяется', () => {
    const a = M.mulberry32(5);
    const b = M.mulberry32(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const x = M.cryptoRng()();
    expect(x >= 0 && x < 1).toBe(true);
  });

  it('ленты: пять барабанов, Wild только на 2–4', () => {
    for (const set of ['cold', 'warm', 'fs'] as const) {
      const strips = M.STRIPS[set];
      expect(strips).toHaveLength(5);
      strips.forEach((strip: string[], index: number) => expect(strip.includes('wild')).toBe(index >= 1 && index <= 3));
    }
  });

  it('оценка: пять королей платят, Wild расширяется и добавляет +1 к множителю, потолок 5000×', () => {
    const res = M.evaluate([
      ['king', 'apple', 'pi'],
      ['king', 'wild', 'rust'],
      ['king', 'berry', 'git'],
      ['king', 'cpp', 'mush'],
      ['king', 'rust', 'orange'],
    ]);
    expect(res.lines.some((line: { sym: string; count: number }) => line.sym === 'king' && line.count === 5)).toBe(true);
    expect(res.expanded).toEqual([1]);
    expect(res.mult).toBe(2);
    const kings = Array.from({ length: 5 }, () => ['king', 'king', 'king']);
    expect(M.evaluate(kings, 10).win).toBe(M.MAX_WIN);
  });

  it('дробная часть выигрыша переносится без потерь', () => {
    let frac = 0;
    let paid = 0;
    let total = 0;
    const rng = M.mulberry32(8);
    for (let i = 0; i < 2000; i++) {
      const amount = (Math.round(rng() * 40) / 20) * 3;
      const settled = M.settle(frac, amount);
      frac = settled.frac;
      paid += settled.whole;
      total += amount;
    }
    expect(Math.abs(paid + frac - total)).toBeLessThan(1e-6);
  });

  it('ежедневные спины: 1,1,2,2,3,3,5, пропуск сбрасывает серию', () => {
    const state = M.newSlotsState();
    let day = new Date(2026, 9, 1, 10);
    const got: number[] = [];
    for (let i = 0; i < 8; i++) {
      got.push(M.dailyClaim(state, day, {}).spins);
      expect(M.dailyClaim(state, day)).toBeNull();
      day = M.addDay(day, 1);
    }
    expect(got).toEqual([1, 1, 2, 2, 3, 3, 5, 1]);
    expect(M.dailyClaim(state, M.addDay(day, 2)).streak).toBe(1);
  });

  it('капсулы: эпик гарантирован не позже 12-й, дубликат шляпы даёт ягоды', () => {
    const state = M.newSlotsState();
    const rng = M.mulberry32(31);
    let gap = 0;
    let maxGap = 0;
    for (let i = 0; i < 1500; i++) {
      const out = M.openCapsule(rng, state);
      if (out.item.rarity === 'epic' || out.item.rarity === 'legendary') {
        maxGap = Math.max(maxGap, gap);
        gap = 0;
      } else gap++;
    }
    expect(maxGap).toBeLessThanOrEqual(M.PITY_CAPSULES);
  });

  it('контрольные суммы замечают ручные правки, а старые данные принимаются', () => {
    const state = M.newSlotsState();
    expect(M.checkSlots(state)).toBe('legacy');
    state.sig = M.signSlots(state);
    expect(M.checkSlots(state)).toBe('ok');
    state.free = 99;
    expect(M.checkSlots(state)).toBe('bad');
    const save = { berries: 10, owned: ['none', 'party'], bonusSpins: 1, boosts: { shield: 1 } } as { berries: number; bsig?: string };
    save.bsig = M.signShared(save);
    expect(M.checkShared(save)).toBe('ok');
    save.berries = 5000;
    expect(M.checkShared(save)).toBe('bad');
  });

  it('плашка на старте игры', () => {
    const now = new Date(2026, 9, 14, 10);
    const save = { bonusSpins: 2, daily: null };
    expect(M.slotsChipText(save, null, now)).toBe('ежедневный спин готов');
    const state = M.newSlotsState();
    state.lastDay = M.dayKey(now);
    state.free = 1;
    expect(M.slotsChipText(save, JSON.stringify(state), now)).toBe('3 бесплатных');
  });
});
