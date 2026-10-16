// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { fromClassic, pullFromClassic, pushToClassic, toClassic } from './classicSync';
import { useSettingsStore } from './settingsStore';

const PALETTES = [
  { id: 'purple', a: '#6548e8', b: '#8068f1' },
  { id: 'green', a: '#1f9d63', b: '#4cbd88' },
];

describe('оформление: классическая → приложение', () => {
  it('переносит палитру, тему и скругления, которые она поменяла', () => {
    const { change, seen } = fromClassic({ palette: 'green', theme: 'dark', radius: 'strict' }, {}, PALETTES);
    expect(change).toEqual({ theme: 'dark', patch: { accent: '#1f9d63', accent2: '#4cbd88', dynamicTheme: 'off', radius: 'sharp' } });
    expect(seen).toEqual({ palette: 'green', theme: 'dark', radius: 'strict' });
  });

  it('то, что не менялось с прошлой сверки, и неизвестные значения не трогает', () => {
    const same = fromClassic({ palette: 'green', theme: 'dark' }, { palette: 'green', theme: 'dark' }, PALETTES);
    expect(same.change).toEqual({ patch: {} });
    expect(fromClassic({ palette: 'nope', theme: 'weird', radius: '??' }, {}, PALETTES).change).toEqual({ patch: {} });
    expect(fromClassic({}, {}, PALETTES).change).toEqual({ patch: {} });
  });
});

describe('оформление: приложение → классическая', () => {
  const app = { theme: 'system' as const, accent: '#5b6cf9', accent2: 'rose', radius: 'normal' as const };

  it('по умолчанию ничего не пишет: у обеих то же самое', () => {
    expect(toClassic(app, {}, {}, PALETTES, 'purple').write).toEqual({});
  });

  it('пишет тему, скругления и палитру, если они отличаются; свои цвета не выражаются — палитра остаётся', () => {
    const out = toClassic(
      { theme: 'dark', accent: '#1F9D63', accent2: '#4cbd88', radius: 'sharp' },
      { palette: 'purple', theme: 'auto' },
      {},
      PALETTES,
      'purple',
    );
    expect(out.write).toEqual({ theme: 'dark', radius: 'strict', palette: 'green' });
    expect(out.seen).toEqual({ theme: 'dark', radius: 'strict', palette: 'green' });
    expect(toClassic({ ...app, accent: '#123456' }, { palette: 'green' }, {}, PALETTES, 'purple').write).toEqual({});
  });

  it('«мягкие» скругления классической остаются, пока у нас «мягкие» — без перезаписи', () => {
    expect(toClassic({ ...app, radius: 'round' }, { radius: 'bubbly' }, {}, PALETTES, 'purple').write).toEqual({});
  });
});

describe('оформление: обмен через хранилище', () => {
  afterEach(() => {
    localStorage.removeItem('m3102-settings-v1');
    localStorage.removeItem('m3102:appearance-sync');
    useSettingsStore.setState({ theme: 'system', accent: 'indigo', accent2: 'rose', radius: 'normal' });
  });

  it('выбор классической подхватывается, а наш выбор уходит к ней вместе с остальными её ключами', () => {
    localStorage.setItem('m3102-settings-v1', JSON.stringify({ palette: 'green', theme: 'dark', font: 'ubuntu' }));
    pullFromClassic();
    const state = useSettingsStore.getState();
    expect([state.theme, state.accent, state.accent2]).toEqual(['dark', '#1f9d63', '#4cbd88']);

    state.setTheme('light');
    pushToClassic();
    expect(JSON.parse(localStorage.getItem('m3102-settings-v1')!)).toEqual({ palette: 'green', theme: 'light', font: 'ubuntu' });

    // Она ничего не меняла с прошлой сверки — наш выбор не перетирается
    pullFromClassic();
    expect(useSettingsStore.getState().theme).toBe('light');
  });
});
