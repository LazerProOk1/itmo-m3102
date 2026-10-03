// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { findTextRange } from './textRange';

it('пометка находится через границы тегов и с другими пробелами', () => {
  const root = document.createElement('div');
  root.innerHTML = '<p>Мнимой единицей называется <strong>пара</strong>\n  i = (0, 1).</p><p>Второй абзац</p>';
  const range = findTextRange(root, 'называется пара i = (0,1)')!;
  expect(range.toString().replace(/\s+/g, ' ')).toBe('называется пара i = (0, 1)');
  expect(findTextRange(root, 'единицей называется пара')!.startContainer.textContent).toContain('Мнимой');
  expect(findTextRange(root, 'нет такого')).toBeNull();
  expect(findTextRange(root, '   ')).toBeNull();
});
