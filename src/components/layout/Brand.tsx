import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import logoUrl from '../../../img/logo-t.png';
import styles from './Brand.module.css';

/** Логотип группы «ITMO | M3102». Ведёт на главную. */
export function Brand() {
  return (
    <Link to={SECTIONS.today.path} className={styles.brand} aria-label="М3102 — главная">
      <span className={styles.logo} style={{ maskImage: `url(${logoUrl})` }} aria-hidden />
    </Link>
  );
}
