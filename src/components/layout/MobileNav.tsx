import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router';
import { MOBILE_TABS, SECTIONS } from '../../app/navigation';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import styles from './MobileNav.module.css';

const TABS = [...MOBILE_TABS, SECTIONS.more];

/**
 * Нижняя панель вкладок на телефоне.
 * Если открыт раздел, которого нет среди вкладок (например, Tasks),
 * подсвечивается «More» — оттуда пользователь в него попал.
 */
export function MobileNav() {
  const { pathname } = useLocation();
  const activeTab = MOBILE_TABS.find((tab) => pathname.startsWith(tab.path)) ?? SECTIONS.more;

  return (
    <nav className={styles.bar} aria-label="Основное меню">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab === activeTab;

        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(styles.tab, isActive && styles.active)}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && <motion.span layoutId="mobile-tab-active" className={styles.pill} transition={SPRING_SNAPPY} />}
            <motion.span className={styles.iconWrap} animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }} transition={SPRING_SNAPPY}>
              <Icon size={20} strokeWidth={1.75} aria-hidden />
            </motion.span>
            <span className={styles.text}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
