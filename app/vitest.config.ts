import { defineConfig } from 'vitest/config';
import { groupFiles } from './scripts/groupFiles.ts';

/**
 * Настройки тестов отдельно от vite.config.ts, чтобы юнит-тесты
 * никак не влияли на сборку и dev-сервер приложения.
 */
export default defineConfig({
  // Виртуальные модули из файлов группы (палитры, снимок данных) — те же, что в сборке
  plugins: [groupFiles()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Тесты интерфейса (*.test.tsx) включают jsdom сами: // @vitest-environment jsdom
    setupFiles: ['src/test/setup.ts'],
  },
});
