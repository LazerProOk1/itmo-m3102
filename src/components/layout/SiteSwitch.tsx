import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buttonClass } from '../ui/Button';
import styles from './SiteSwitch.module.css';

/** Классическое оформление лежит в репозитории (public/classic, обновляется npm run classic). Нет копии — кнопки нет, а не ссылка в пустоту. */
const CLASSIC_URL = './classic/index.html';
let available: Promise<boolean> | undefined;
const hasClassicCopy = () =>
  (available ??= fetch(CLASSIC_URL, { method: 'HEAD' }).then(
    (response) => response.ok,
    () => false,
  ));

/**
 * «Переключить стиль» в ряду кнопок шапки — главная кнопка (залита акцентом), чтобы её было видно сразу, но без
 * отдельной плашки: общий сайт с двумя оформлениями. Сам переход с волной делает public/switch/site-switch.js по
 * data-site-switch; во втором оформлении такая же кнопка — в его шапке и в его фиолетовом акценте (там же).
 */
export function SiteSwitch() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void hasClassicCopy().then((ok) => alive && setReady(ok));
    return () => {
      alive = false;
    };
  }, []);
  if (!ready) return null;
  return (
    <a
      href={CLASSIC_URL}
      data-site-switch
      className={`${buttonClass('primary', 'sm')} ${styles.switch}`}
      title="Переключить стиль оформления"
      aria-label="Переключить стиль"
    >
      <ArrowLeftRight size={14} strokeWidth={2} aria-hidden />
      <span className={styles.text}>Переключить стиль</span>
    </a>
  );
}
