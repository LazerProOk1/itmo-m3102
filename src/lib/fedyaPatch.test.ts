import { expect, it } from 'vitest';
import { patchFedyaIndex } from './fedyaPatch';

const SOURCE = `<!DOCTYPE html><html><head><link rel="manifest" href="manifest.webmanifest">
<title>M3102</title></head><body><script>
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
</script></body></html>`;

it('патч сайта Феди: без service worker и манифеста, с переключателем стиля в <head>', () => {
  const html = patchFedyaIndex(SOURCE);
  expect(html).not.toContain('sw.js');
  expect(html).not.toContain('manifest');
  expect(html).toContain("window.addEventListener('load', () => Promise.resolve())");
  expect(html.indexOf('../switch/switch.js')).toBeLessThan(html.indexOf('</head>'));
});

it('патч сайта Феди: разметка без </head> — понятная ошибка, а не тихо сломанная копия', () => {
  expect(() => patchFedyaIndex('<html></html>')).toThrow(/patchFedyaIndex/);
});
