import { defineConfig } from 'vitest/config';

/**
 * Настройки тестов отдельно от vite.config.ts, чтобы юнит-тесты
 * никак не влияли на сборку и dev-сервер приложения.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Тесты интерфейса (*.test.tsx) включают jsdom сами: // @vitest-environment jsdom
    setupFiles: ['src/test/setup.ts'],
  },
});
