import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import sync from './SyncButton.module.css';

/** Копия сайта Феди лежит рядом (public/fedya, её кладёт npm run fedya). Нет копии — кнопки нет, а не ссылка в пустоту. */
const FEDYA_URL = './fedya/index.html';
let available: Promise<boolean> | undefined;
const hasFedyaCopy = () =>
  (available ??= fetch(FEDYA_URL, { method: 'HEAD' }).then(
    (response) => response.ok,
    () => false,
  ));

/**
 * «Переключить стиль» в ряду кнопок шапки, оформлена как соседняя «Синхронизировать» (её стили): общий сайт с двумя
 * оформлениями, а не рекламный баннер. Сам переход с волной делает public/switch/switch.js по data-site-switch;
 * на сайте Феди такая же кнопка — в его шапке и в его оформлении (там же).
 */
export function SiteSwitch() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void hasFedyaCopy().then((ok) => alive && setReady(ok));
    return () => {
      alive = false;
    };
  }, []);
  if (!ready) return null;
  return (
    <a href={FEDYA_URL} data-site-switch className={sync.button} title="Переключить стиль оформления" aria-label="Переключить стиль">
      <ArrowLeftRight size={15} strokeWidth={1.75} aria-hidden />
      <span className={sync.text}>Переключить стиль</span>
    </a>
  );
}
