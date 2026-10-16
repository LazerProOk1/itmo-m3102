import { describe, expect, it } from 'vitest';
import { parseClassicPalettes } from './classicPalettes';

const CSS = `:root{
  --pal-purple-a:#6548e8;--pal-purple-b:#8068f1;
  --pal-green-a:#1F9D63;--pal-green-b:#4cbd88;
  --pal-gold-a:#c28a12;--pal-gold-b:#f0c95a;
  --pal-broken-a:#111111;
}
:root[data-palette="green"]{--accent:var(--pal-green-a)}`;

const JS = `const FONTS = [
  { id: 'noto', name: 'Noto Sans', var: '--ff-noto', note: 'По умолчанию' },
];
const PALETTES = [
  { id: 'purple', name: 'Фиолетовая' },
  { id: 'green', name: 'Зелёная' },
  { id: 'gold', name: 'Золото' },
  { id: 'broken', name: 'Без второго цвета' },
];
const DEFAULT_PALETTE = 'green';
const BASE_PALETTES = ['purple', 'green'];`;

describe('parseClassicPalettes', () => {
  it('собирает пары цветов, названия и «базовые» из файлов группы', () => {
    const { palettes, defaultId } = parseClassicPalettes(CSS, JS);
    expect(palettes).toEqual([
      { id: 'purple', name: 'Фиолетовая', a: '#6548e8', b: '#8068f1', base: true },
      { id: 'green', name: 'Зелёная', a: '#1F9D63', b: '#4cbd88', base: true },
      { id: 'gold', name: 'Золото', a: '#c28a12', b: '#f0c95a', base: false },
    ]);
    expect(defaultId).toBe('green');
  });

  it('шрифты не принимает за палитры, а неизвестную палитру по умолчанию заменяет первой', () => {
    const { palettes, defaultId } = parseClassicPalettes(CSS, JS.replace("'green';", "'nope';"));
    expect(palettes.map((item) => item.id)).not.toContain('noto');
    expect(defaultId).toBe('purple');
  });

  it('пустой разбор — пустой список (сборка по этому падает)', () => {
    expect(parseClassicPalettes('', '').palettes).toEqual([]);
  });
});
