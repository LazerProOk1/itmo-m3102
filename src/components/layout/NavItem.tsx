import { NavLink } from 'react-router';
import type { Section } from '../../app/navigation';
import { cn } from '../../lib/cn';
import styles from './NavItem.module.css';

interface NavItemProps {
  section: Section;
}

/** Пункт бокового меню. NavLink сам знает, открыта ли сейчас эта страница. */
export function NavItem({ section }: NavItemProps) {
  const Icon = section.icon;

  return (
    <NavLink
      to={section.path}
      className={({ isActive }) => cn(styles.link, isActive && styles.active)}
    >
      <Icon size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />
      <span className={styles.label}>{section.label}</span>
    </NavLink>
  );
}
