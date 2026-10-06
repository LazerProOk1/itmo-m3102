import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/unbounded';
import './styles/tokens.css';
import './styles/global.css';
import './styles/aurora.css';
import { App } from './app/App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* «Уменьшить движение» в системе — framer-motion сам отключает сдвиги и пружины везде */}
    <MotionConfig reducedMotion="user">
      {/* Последний рубеж: ошибка вне страниц (шапка, меню) — сообщение вместо белого экрана */}
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MotionConfig>
  </StrictMode>,
);

// Офлайн-режим и установка на телефон (public/sw.js). Только в сборке: в разработке кеш мешал бы HMR
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}
