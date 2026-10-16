// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { ClassicPalette } from '../../lib/classicPalettes';
import { classicPreset, classicToSettings, readClassicAppearance } from './classicAppearance';

const PALETTES: ClassicPalette[] = [
  { id: 'purple', name: 'Фиолетовая', a: '#6548e8', b: '#8068f1', base: true },
  { id: 'green', name: 'Зелёная', a: '#1f9d63', b: '#4cbd88', base: true },
];

afterEach(() => localStorage.removeItem('m3102-settings-v1'));

describe('оформление из классической версии', () => {
  it('читает выбор из её ключа, а пустое хранилище — null', () => {
    expect(readClassicAppearance()).toBeNull();
    localStorage.setItem('m3102-settings-v1', JSON.stringify({ font: 'noto' }));
    expect(readClassicAppearance()).toBeNull();
    localStorage.setItem('m3102-settings-v1', JSON.stringify({ palette: 'green', theme: 'dark', radius: 'strict', font: 'noto' }));
    expect(readClassicAppearance()).toEqual({ palette: 'green', theme: 'dark', radius: 'strict' });
  });

  it('палитра, тема и скругления переходят в наши настройки', () => {
    const change = classicToSettings({ palette: 'green', theme: 'auto', radius: 'bubbly' }, PALETTES);
    expect(change.theme).toBe('system');
    expect(change.patch).toEqual({ accent: '#1f9d63', accent2: '#4cbd88', dynamicTheme: 'off', radius: 'round' });
    expect(change.summary).toEqual(['палитра «Зелёная»', 'тема как на устройстве', 'скругления']);
  });

  it('неизвестные значения пропускаются', () => {
    const change = classicToSettings({ palette: 'nope', theme: 'weird', radius: '??' }, PALETTES);
    expect(change).toEqual({ patch: {}, summary: [] });
  });

  it('пресет: палитра по умолчанию и без сияния', () => {
    const change = classicPreset(PALETTES, 'purple');
    expect(change.patch).toMatchObject({ accent: '#6548e8', accent2: '#8068f1', aurora: false, glow: false, liveBg: false, radius: 'normal' });
  });
});
