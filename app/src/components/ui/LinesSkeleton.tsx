import styles from './LinesSkeleton.module.css';

const WIDTHS = [92, 100, 78, 96, 64];

/** Строки-заглушки на месте текста, пока он грузится. Появляются не сразу: на быстрой загрузке их просто не видно. */
export function LinesSkeleton({ label = 'Загрузка' }: { label?: string }) {
  return (
    <div className={styles.lines} aria-busy="true" aria-label={label}>
      {WIDTHS.map((width, index) => (
        <span key={index} style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}
