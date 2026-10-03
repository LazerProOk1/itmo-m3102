// Иконки сайта из логотипа группы (scripts/icon/source.jpg, белый ёжик и «ITMO | M3102» на чёрном).
// Запуск: node scripts/icon/make-icons.mjs — рисует в браузере (Edge через Playwright) и пишет в public/:
//   favicon.png 64 — вкладка браузера: только ёжик (надпись в 16–32px не читается), чёрный квадрат со скруглением
//   icon-192.png, icon-512.png, apple-touch-icon.png 180 — логотип целиком
//   icon-maskable-512.png — логотип в «безопасной зоне» (80%): Android обрезает иконку кругом или каплей
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync(new URL('./source.jpg', import.meta.url)).toString('base64');
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });
const page = await browser.newPage();

const images = await page.evaluate(async (jpeg) => {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${jpeg}`;
  await img.decode();

  // Чистим JPEG: тёмное — в чёрный, светлое — в белый, середину (сглаживание краёв) растягиваем
  const clean = document.createElement('canvas');
  clean.width = img.width;
  clean.height = img.height;
  const cctx = clean.getContext('2d');
  cctx.drawImage(img, 0, 0);
  const data = cctx.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
    const out = Math.max(0, Math.min(255, ((v - 50) / (205 - 50)) * 255));
    data.data[i] = data.data[i + 1] = data.data[i + 2] = out;
  }
  cctx.putImageData(data, 0, 0);

  // Рамка ёжика: белые точки выше надписи (надпись — нижняя треть)
  let [left, top, right, bottom] = [img.width, img.height, 0, 0];
  for (let y = 0; y < img.height * 0.68; y++)
    for (let x = 0; x < img.width; x++)
      if (data.data[(y * img.width + x) * 4] > 128) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }

  const render = (size, draw, radius = 0) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.clip();
    draw(ctx, size);
    return canvas.toDataURL('image/png');
  };
  const whole = (scale) => (ctx, size) => {
    const side = size * scale;
    ctx.drawImage(clean, (size - side) / 2, (size - side) / 2, side, side);
  };
  const hedgehog = (ctx, size) => {
    const pad = size * 0.12;
    const w = right - left;
    const h = bottom - top;
    const k = (size - pad * 2) / Math.max(w, h);
    ctx.drawImage(clean, left, top, w, h, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
  };

  return {
    'favicon.png': render(64, hedgehog, 14),
    'icon-192.png': render(192, whole(1)),
    'icon-512.png': render(512, whole(1)),
    'apple-touch-icon.png': render(180, whole(1)),
    'icon-maskable-512.png': render(512, whole(0.8)),
  };
}, source);

for (const [name, url] of Object.entries(images)) {
  writeFileSync(new URL(`../../public/${name}`, import.meta.url), Buffer.from(url.split(',')[1], 'base64'));
  console.log('public/' + name);
}
await browser.close();
