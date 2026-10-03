import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Относительные пути к файлам сборки: сайт будет работать из любой подпапки,
  // например https://<username>.github.io/itmo-m3102/
  base: './',
  // Список файлов сборки: service worker (public/sw.js) по нему кладёт в кеш весь сайт для офлайна
  build: { manifest: 'asset-manifest.json' },
});
