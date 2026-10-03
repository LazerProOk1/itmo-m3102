import { expect, test, type Page } from '@playwright/test';
import { mockGithub, NOTE_MD, NOTE_PDF, PDF_PAGES } from './github';

const noteUrl = (path: string) => `#/materials/notes/${encodeURIComponent(`gh:${path}`)}`;

test.beforeEach(async ({ page }) => {
  // Четверг 1 октября 2026, полдень: в расписании по умолчанию есть пары
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00+03:00'));
  await mockGithub(page);
});

/** Открыть страницу и дождаться первой синхронизации с (подменённым) GitHub */
async function openSynced(page: Page, path = './') {
  await page.goto(path);
  await page.waitForFunction(() => localStorage.getItem('m3102:last-sync') !== null);
}

test('с главной предмет открывается сразу', async ({ page }) => {
  await openSynced(page);
  const link = page.locator('a[href="#/subjects/dm"]').first();
  await link.hover();
  // Время меряем в самой странице, от клика до нового заголовка: часы теста врут под нагрузкой (параллельные тесты)
  const opened = page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let clicked = 0;
        document.addEventListener('click', () => (clicked = performance.now()), { capture: true, once: true });
        const observer = new MutationObserver(() => {
          if (!clicked || !document.querySelector('main h1')?.textContent?.includes('Дискретная математика')) return;
          observer.disconnect();
          resolve(performance.now() - clicked);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      }),
  );
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Дискретная математика' })).toBeVisible();
  // Раньше переход с анимацией заголовка висел ~2 с; сейчас ~80 мс (под нагрузкой параллельных тестов — до ~0,5 с)
  expect(await opened).toBeLessThan(1000);
});

test('поиск находит слово в тексте конспекта и открывает его', async ({ page }) => {
  await openSynced(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('зюзюка');
  await expect(page.getByRole('dialog').getByRole('option', { name: /Графы/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: /Графы/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Степени' })).toBeVisible();
});

test('неделя расписания — сеткой по часам', async ({ page }) => {
  await page.goto('./#/schedule?date=2026-10-01');
  const card = page.getByText('09:50–11:20').first();
  await expect(card).toBeVisible();
  // Высота карточки — длительность пары (90 мин), а не высота текста
  expect((await card.locator('xpath=../..').boundingBox())?.height).toBeGreaterThan(90);
});

test('PDF: тёмные страницы и «Продолжить» с прошлого места', async ({ page }) => {
  await page.goto(`./${noteUrl(NOTE_PDF)}`);
  const canvases = page.locator('canvas[data-page]');
  await expect(canvases).toHaveCount(PDF_PAGES);

  await page.getByRole('button', { name: 'Тёмные страницы' }).click();
  await expect(canvases.first()).toHaveCSS('filter', /invert/);

  await canvases.nth(4).scrollIntoViewIfNeeded();
  await expect(page.getByText(`5 / ${PDF_PAGES}`)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /5 стр/ }).click();
  await expect(page.getByText(`5 / ${PDF_PAGES}`)).toBeVisible();
});

test('без сети сайт открывается из кеша', async ({ page, context }) => {
  await page.goto(`./${noteUrl(NOTE_MD)}`);
  await expect(page.getByRole('heading', { name: 'Определение' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Определение' })).toBeVisible();
});

test('телефон: свайп листает дни, страницы не шире экрана @phone', async ({ page }) => {
  await page.goto('./#/schedule?date=2026-10-01');
  const selected = page.getByRole('tab', { selected: true });
  await expect(selected).toContainText('1');
  await page.evaluate(() => {
    const area = document.querySelector('[class*="swipe"]')!;
    const touch = (x: number) => new Touch({ identifier: 1, target: area, clientX: x, clientY: 400 });
    area.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(300)], changedTouches: [touch(300)], bubbles: true }));
    area.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(100)], bubbles: true }));
  });
  await expect(page.getByRole('tab', { selected: true })).toContainText('2');

  for (const path of ['./', './#/schedule', './#/materials', './#/subjects', './#/calendar', `./${noteUrl(NOTE_MD)}`]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0);
  }
});
