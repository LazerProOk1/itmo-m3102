import { motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { HomeworkDialog } from '../../features/homework/HomeworkDialog';
import { SearchDialog } from '../../features/search/SearchDialog';
import { useSearchShortcut } from '../../features/search/useSearchShortcut';
import { useApplyTheme } from '../../features/settings/theme';
import { SPRING_SMOOTH, usePrefersReducedMotion } from '../../lib/motion';
import { useScrollMemory } from '../../lib/useScrollMemory';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

/**
 * Каркас приложения: боковое меню + верхняя панель + область страницы.
 * На телефоне боковое меню скрывается, внизу появляется панель вкладок.
 * <Outlet /> — место, куда React Router подставляет текущую страницу.
 */
export function AppShell() {
  const [isSearchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const location = useLocation();
  const reduceMotion = usePrefersReducedMotion();

  useApplyTheme();
  useScrollMemory();
  useSearchShortcut(openSearch);

  return (
    <div className={styles.shell}>
      <Sidebar />

      <div className={styles.column}>
        <TopBar onOpenSearch={openSearch} />
        <main className={styles.content}>
          {/*
           * Нарочно без AnimatePresence/exit-анимации ухода: <Outlet/> — общий на всё
           * приложение компонент, подписанный на роутер-контекст. Если "замороженную"
           * уходящую копию держит в DOM AnimatePresence, её Outlet всё равно перерисуется
           * на НОВЫЙ маршрут при смене контекста (контекст пробивает любые bailout'ы React) —
           * так старая и новая страница на деле превращались в две копии одного и того же
           * нового контента, что и читалось как "мигание"/задержавшаяся предыдущая страница.
           * Поэтому уходящая страница просто убирается сразу — только новая мягко появляется.
           */}
          <motion.div
            key={location.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: SPRING_SMOOTH }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      <MobileNav />
      <SearchDialog open={isSearchOpen} onClose={() => setSearchOpen(false)} />
      <HomeworkDialog />
    </div>
  );
}
