// @ts-nocheck — модули node:* без типов: @types/node ради одного плагина не ставим
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { parseClassicPalettes } from '../src/lib/classicPalettes.ts';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const readRepoFile = (path: string) => readFileSync(join(REPO_ROOT, path), 'utf8');

/**
 * Файлы группы, которые приложение читает при сборке (сами не меняем): палитры классической версии и снимок данных
 * (дедлайны, ДЗ, ссылки, расписание) — стартовое содержимое до первой синхронизации. Формат сломали — сборка падает, а не молчит.
 */
export function groupFiles(): Plugin {
  const modules: Record<string, () => unknown> = {
    'virtual:classic-palettes': () => {
      const data = parseClassicPalettes(readRepoFile('css/settings.css'), readRepoFile('js/settings.js'));
      if (data.palettes.length === 0) throw new Error('в css/settings.css и js/settings.js не нашлось палитр');
      return data;
    },
    'virtual:group-snapshot': () => ({
      deadlines: JSON.parse(readRepoFile('Дедлайны/deadlines.json')),
      homework: JSON.parse(readRepoFile('data/homework.json')),
      links: JSON.parse(readRepoFile('data/links.json')),
      schedule: JSON.parse(readRepoFile('data/schedule.json')),
    }),
  };
  return {
    name: 'group-files',
    resolveId: (source) => (source in modules ? `\0${source}` : undefined),
    load(id) {
      const make = id.startsWith('\0') ? modules[id.slice(1)] : undefined;
      if (!make) return undefined;
      try {
        return `export default ${JSON.stringify(make())};`;
      } catch (error) {
        return this.error(`${id.slice(1)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
