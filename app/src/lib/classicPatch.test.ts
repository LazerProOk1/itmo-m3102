import { expect, it } from 'vitest';
import { patchClassicIndex } from './classicPatch';

const SOURCE = `<!DOCTYPE html><html><head><link rel="manifest" href="manifest.webmanifest">
<title>M3102</title></head><body><script>
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
</script></body></html>`;

it('патч классического сайта группы: без service worker и манифеста, с переключателем стиля в <head>', () => {
  const html = patchClassicIndex(SOURCE);
  expect(html).not.toContain('sw.js');
  expect(html).not.toContain('manifest');
  expect(html).toContain("window.addEventListener('load', () => Promise.resolve())");
  expect(html.indexOf('./switch/site-switch.js')).toBeLessThan(html.indexOf('</head>'));
  expect(html).toContain('<html data-site-style="classic">');
});

it('патч классического сайта группы: разметка без </head> — понятная ошибка, а не тихо сломанная копия', () => {
  expect(() => patchClassicIndex('<html></html>')).toThrow(/patchClassicIndex/);
});
