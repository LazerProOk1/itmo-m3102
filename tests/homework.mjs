import test from 'node:test';
import assert from 'node:assert/strict';
import { renderText } from '../js/homework-text.js';

test('разметка ДЗ выводит безопасные списки и ссылки', () => {
  const html = renderText('- **Первый**\n- [Второй](https://example.com)\n<script>alert(1)</script>');
  assert.match(html, /<ul><li><strong>Первый<\/strong><\/li><li><a href="https:\/\/example.com\/"/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
