import styles from './PageSkeleton.module.css';

/**
 * Пока догружается страница — её «скелет»: заголовок и блоки на своих местах, а не пустой фон.
 * Появляется с задержкой 150 мс: быстрая загрузка не успевает мигнуть заглушкой.
 */
export function PageSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Страница загружается">
      <span className={styles.title} />
      <span className={styles.subtitle} />
      <div className={styles.grid}>
        <span className={styles.block} />
        <span className={styles.block} />
        <span className={styles.wide} />
      </div>
    </div>
  );
}
