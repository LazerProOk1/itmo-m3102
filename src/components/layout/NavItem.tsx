import { motion } from 'framer-motion';
import { NavLink } from 'react-router';
import type { Section } from '../../app/navigation';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import styles from './NavItem.module.css';

interface NavItemProps {
  section: Section;
}

/** Пункт бокового меню. Подсветка активного пункта — одна на всё меню и плавно переезжает между пунктами. */
export function NavItem({ section }: NavItemProps) {
  const Icon = section.icon;

  return (
    <NavLink to={section.path} className={({ isActive }) => cn(styles.link, isActive && styles.active)}>
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="sidebar-active" className={styles.pill} transition={SPRING_SNAPPY} />}
          <Icon size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />
          <span className={styles.label}>{section.label}</span>
        </>
      )}
    </NavLink>
  );
}
