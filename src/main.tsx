import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/global.css';
import './styles/aurora.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* «Уменьшить движение» в системе — framer-motion сам отключает сдвиги и пружины везде */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
