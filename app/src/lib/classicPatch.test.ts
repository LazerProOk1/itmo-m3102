import { expect, it } from 'vitest';
import { patchClassicIndex } from './classicPatch';

const SOURCE = `<!DOCTYPE html><html><head><link rel="manifest" href="manifest.webmanifest">
<title>M3102</title></head><body><script>
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
</script></body></html>`;

it('патч классического сайта группы: без манифеста, с его service worker и переключателем стиля в <head>', () => {
  const html = patchClassicIndex(SOURCE);
  expect(html).not.toContain('manifest');
  // Его офлайн-режим сохраняем: регистрация воркера остаётся как есть
  expect(html).toContain("navigator.serviceWorker.register('./sw.js')");
  expect(html.indexOf('./switch/site-switch.js')).toBeLessThan(html.indexOf('</head>'));
  expect(html).toContain('<html data-site-style="classic">');
});

it('патч классического сайта группы: список скрытых файлов приводится к нижнему регистру (иначе AGENTS.md и CLAUDE.md видны)', () => {
  const html = patchClassicIndex(
    "<html><head></head><body><script>const HIDDEN_FILE_NAMES=['site.css','sw.js', 'CLAUDE.md', 'AGENTS.md', '.git-blame-ignore-revs'];</script></body></html>",
  );
  expect(html).toContain("['site.css','sw.js', 'claude.md', 'agents.md', '.git-blame-ignore-revs']");
  expect(html).toContain('HIDDEN_FILE_NAMES');
});

it('патч классического сайта группы: разметка без </head> — понятная ошибка, а не тихо сломанная копия', () => {
  expect(() => patchClassicIndex('<html></html>')).toThrow(/patchClassicIndex/);
});
