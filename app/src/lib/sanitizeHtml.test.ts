// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

it('убирает скрипты, обработчики и опасные ссылки, оставляет текст и таблицы', () => {
  const html = sanitizeHtml(
    '<p onclick="x()">Привет <strong>мир</strong></p><script>alert(1)</script><a href="javascript:alert(1)">плохо</a><a href="https://a.b">хорошо</a>' +
      '<img src="javascript:1"><img src="data:image/png;base64,AAAA" alt="ок"><table><tr><td colspan="2">я</td></tr></table><custom-tag>текст</custom-tag>',
  );
  expect(html).not.toContain('script');
  expect(html).not.toContain('onclick');
  expect(html).not.toContain('javascript:');
  expect(html).toContain('<strong>мир</strong>');
  expect(html).toContain('href="https://a.b"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('data:image/png;base64,AAAA');
  expect(html).toContain('colspan="2"');
  expect(html).toContain('текст');
});
