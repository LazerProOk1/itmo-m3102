import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
// Копия img/logo-t.png (1606px, 112 КБ) под размер шапки: маске нужна только прозрачность
import logoUrl from '../../assets/logo-mask.webp';
import styles from './Brand.module.css';

/** Логотип группы «ITMO | M3102». Ведёт на главную. */
export function Brand() {
  return (
    <Link to={SECTIONS.today.path} className={styles.brand} aria-label="М3102 — главная">
      <span className={styles.logo} style={{ maskImage: `url(${logoUrl})` }} aria-hidden />
    </Link>
  );
}
