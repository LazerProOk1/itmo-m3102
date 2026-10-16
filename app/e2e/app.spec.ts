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
  // Первое открытие стартует со снимка данных группы и потом меняет расписание на синхронизированное — ждём, пока оно устоится
  await openSynced(page, './#/schedule?date=2026-10-01');
  const card = page.getByText('09:50–11:20').first();
  await expect(card).toBeVisible();
  // Высота карточки — длительность пары (90 мин), а не высота текста
  expect((await card.locator('xpath=../..').boundingBox())?.height).toBeGreaterThan(90);
});

test('календарь — месяц расписания: старый адрес открывает месяц, нажатие на число — день', async ({ page }) => {
  await page.goto('./#/calendar');
  await expect(page).toHaveURL(/#\/schedule\?view=month$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Расписание' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Месяц' })).toBeChecked();
  await expect(page.getByText('Октябрь 2026')).toBeVisible();
  await page.getByRole('button', { name: '15', exact: true }).click();
  await expect(page).toHaveURL(/view=day/);
  await expect(page.getByRole('radio', { name: 'День' })).toBeChecked();
});

test('перенос отметок из классической версии: сначала превью, потом перенос; её ключи не меняются', async ({ page }) => {
  await page.goto('./#/settings?tab=data');
  const classic = {
    hw: JSON.stringify({ 'hw-1': '2026-10-08T23:00:52.587Z', 'hw-2': null }),
    plan: JSON.stringify({ tasks: [], done: { 'deadline:dm-hw': true, 'deadline:op-lab1': false } }),
  };
  await page.evaluate((marks) => {
    localStorage.setItem('m3102-hw-done-v1', marks.hw);
    localStorage.setItem('m3102-study-plan-v1', marks.plan);
  }, classic);
  await page.reload();

  await page.getByRole('button', { name: 'Перенести отметки из классической версии' }).click();
  await expect(page.getByText('Найдено в классической версии')).toBeVisible();
  await page.getByRole('button', { name: 'Перенести', exact: true }).click();
  await expect(page.getByText('Перенесено отметок: 2.')).toBeVisible();

  const stored = await page.evaluate(() => ({
    hw: localStorage.getItem('m3102-hw-done-v1'),
    plan: localStorage.getItem('m3102-study-plan-v1'),
    homework: JSON.parse(localStorage.getItem('m3102:homework') ?? '{}').state?.done,
    deadlines: JSON.parse(localStorage.getItem('m3102:group') ?? '{}').state?.deadlinesDone,
  }));
  expect(stored.homework).toEqual({ 'hw-1': '2026-10-08T23:00:52.587Z' });
  expect(stored.deadlines).toEqual({ 'dm-hw': true });
  expect(stored.hw).toBe(classic.hw);
  expect(stored.plan).toBe(classic.plan);
});

test('PDF: страницы под тему сайта, тёмные по кнопке, «Продолжить» с прошлого места', async ({ page }) => {
  // По умолчанию страницы PDF следуют теме сайта: в тёмной — сразу тёмные
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`./${noteUrl(NOTE_PDF)}`);
  const canvases = page.locator('canvas[data-page]');
  await expect(canvases).toHaveCount(PDF_PAGES);
  await expect(canvases.first()).toHaveCSS('filter', /invert/);

  // В светлой — светлые, а кнопка включает тёмные
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Тёмные страницы' }).click();
  await expect(canvases).toHaveCount(PDF_PAGES);
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

test('переключатель стиля: на классический сайт (корень адреса) и обратно в приложение, слой перехода не застревает', async ({ page }) => {
  // Классический сайт в сборке есть, но он ходит в сеть (библиотеки, GitHub) — подменяем его корневую страницу, остальное настоящее
  await page.route(
    (url) => url.pathname === '/',
    (route) =>
      route.request().method() === 'HEAD'
        ? route.fulfill({ status: 200 })
        : route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: '<!doctype html><html data-site-style="classic"><head><meta charset="utf-8"><script src="./switch/site-switch.js" charset="utf-8"></script></head><body><h1>Классический сайт</h1></body></html>',
          }),
  );
  await openSynced(page);
  await page.getByRole('link', { name: 'Классическая версия' }).first().click();
  await expect(page).toHaveURL(/localhost:4173\/$/);
  // В классическом оформлении та же кнопка рисуется скриптом; слой перехода после прихода убирается
  const back = page.locator('[data-site-switch]');
  await expect(back).toHaveText('Новая версия');
  await expect(page.locator('[data-site-veil]')).toHaveCount(0, { timeout: 5000 });
  await back.click();
  await expect(page).toHaveURL(/\/app\/(#.*)?$/);
  await expect(page.getByRole('link', { name: 'Классическая версия' }).first()).toBeVisible();
  await expect(page.locator('[data-site-veil]')).toHaveCount(0, { timeout: 5000 });
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

  for (const path of [
    './',
    './#/schedule',
    './#/materials',
    './#/subjects',
    './#/calendar',
    './#/schedule?view=month',
    './#/homework',
    `./${noteUrl(NOTE_MD)}`,
  ]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0);
  }
});

test('телефон: панель — Главная, Расписание, Материалы, Дедлайны, Ещё; ДЗ — вкладка дедлайнов @phone', async ({ page }) => {
  await page.goto('./#/deadlines');
  const bar = page.getByRole('navigation', { name: 'Основное меню' });
  await expect(bar.getByRole('link')).toHaveText(['Главная', 'Расписание', 'Материалы', 'Дедлайны', 'Ещё']);
  await expect(bar.getByRole('link', { name: 'Дедлайны' })).toHaveAttribute('aria-current', 'page');

  // Старый адрес ДЗ открывает вкладку «Домашние задания»; в панели по-прежнему «Дедлайны»
  await page.goto('./#/homework');
  await expect(page).toHaveURL(/#\/deadlines\?tab=homework$/);
  await expect(page.getByRole('tab', { name: /Домашние задания/, selected: true })).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Дедлайны' })).toHaveAttribute('aria-current', 'page');

  // Вложенный адрес подсвечивает «Материалы»
  await openSynced(page, `./${noteUrl(NOTE_MD)}`);
  await expect(bar.getByRole('link', { name: 'Материалы' })).toHaveAttribute('aria-current', 'page');

  // «Главная» — вкладка; логотип в шапке ведёт туда же
  await page.locator('header').getByRole('link', { name: 'М3102 — главная' }).click();
  await expect(page).toHaveURL(/#\/today$/);
  await expect(bar.getByRole('link', { name: 'Главная' })).toHaveAttribute('aria-current', 'page');
  // «Ещё» — остальные разделы; Главной там уже нет
  await bar.getByRole('link', { name: /^Ещё/ }).click();
  await expect(page.locator('main ul a').first()).toHaveText('Учебный план');
});
