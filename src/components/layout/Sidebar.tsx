import { SECTIONS, SIDEBAR_PRIMARY, SIDEBAR_SECONDARY, type Section } from '../../app/navigation';
import { Brand } from './Brand';
import { NavItem } from './NavItem';
import { ThemeToggle } from './ThemeToggle';
import styles from './Sidebar.module.css';

/** Боковое меню (только на компьютере и планшете). */
export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Brand />
      </div>

      <nav className={styles.nav} aria-label="Основное меню">
        <NavGroup sections={SIDEBAR_PRIMARY} />
        <hr className={styles.divider} />
        <NavGroup sections={SIDEBAR_SECONDARY} />
      </nav>

      <div className={styles.footer}>
        <div className={styles.footerLink}>
          <NavItem section={SECTIONS.settings} />
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}

interface NavGroupProps {
  sections: Section[];
}

function NavGroup({ sections }: NavGroupProps) {
  return (
    <ul className={styles.group}>
      {sections.map((section) => (
        <li key={section.path}>
          <NavItem section={section} />
        </li>
      ))}
    </ul>
  );
}
