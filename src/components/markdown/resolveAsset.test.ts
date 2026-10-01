import { describe, expect, it } from 'vitest';
import { resolveAsset } from './Markdown';

describe('resolveAsset', () => {
  const base = 'https://raw.githubusercontent.com/RedstoneLord/itmo-m3102/master/%D0%9A/%D0%94%D0%9C/%D0%9B%D0%B5%D0%BA%D1%86%D0%B8%D1%8F_4/';

  it('относительная картинка — рядом с файлом конспекта', () => {
    expect(resolveAsset('../img/diagram.svg', base)).toBe('https://raw.githubusercontent.com/RedstoneLord/itmo-m3102/master/%D0%9A/%D0%94%D0%9C/img/diagram.svg');
  });

  it('абсолютные адреса и data: не трогаются', () => {
    expect(resolveAsset('https://example.com/a.png', base)).toBe('https://example.com/a.png');
    expect(resolveAsset('data:image/png;base64,AA', base)).toBe('data:image/png;base64,AA');
    expect(resolveAsset('a.png')).toBe('a.png');
  });
});
