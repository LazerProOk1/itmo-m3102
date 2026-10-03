import { expect, it } from 'vitest';
import { splitSections } from './splitSections';

it('режет по ## вне кода, формул и выносок; текст не теряется', () => {
  const text = [
    '# Заголовок',
    'вступление',
    '## Первый',
    '```cpp',
    '## не заголовок, а код',
    '```',
    '$$',
    '## тоже не заголовок',
    '$$',
    ':::note',
    '## внутри выноски',
    ':::',
    '## Второй',
    'текст',
  ].join('\n');
  const sections = splitSections(text);
  expect(sections).toHaveLength(3);
  expect(sections[1]!.startsWith('## Первый')).toBe(true);
  expect(sections[2]).toBe('## Второй\nтекст');
  expect(sections.join('\n')).toBe(text);
  expect(splitSections('## Сразу заголовок\nтекст')).toEqual(['## Сразу заголовок\nтекст']);
});
