import { defineConfig, devices } from '@playwright/test';

/**
 * Автотесты в настоящем браузере — по собранному сайту (vite preview), как на GitHub Pages: с сервис-воркером,
 * разбиением на чанки и переходами. GitHub подменяется заглушками (e2e/github.ts) — тесты не ходят в сеть.
 * Локально — установленный Edge; в CI — Chromium от Playwright.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    channel: process.env.CI ? undefined : 'msedge',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'msedge' }, grepInvert: /@phone/ },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'msedge' }, grep: /@phone/ },
  ],
  webServer: {
    // В CI сборка уже сделана предыдущим шагом
    command: process.env.CI ? 'npx vite preview --port 4173 --strictPort' : 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
