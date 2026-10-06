import { useEffect } from 'react';

const SITE = 'М3102';

/**
 * Название вкладки браузера: «М3102 — Главная», «М3102 — Лекция 2. Предикаты». Раздел ставит шапка (TopBar)
 * при каждой смене адреса; страница с собственным названием (конспект, предмет) уточняет его своим вызовом —
 * её эффект срабатывает позже шапки, потому что страница идёт в разметке после неё.
 */
export function useDocumentTitle(part: string | undefined, key?: string) {
  useEffect(() => {
    document.title = part ? `${SITE} — ${part}` : `${SITE} — учебное пространство`;
  }, [part, key]);
}
