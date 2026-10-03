import { useSyncExternalStore } from 'react';

/** Совпадает ли медиазапрос сейчас — и перерисовка, когда перестаёт (поворот телефона, сужение окна) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
