import { useState } from 'react';
import type { Event, ISODate } from '../../types/models';
import type { EventDialogTarget } from './EventDialog';

/** Какое окно события открыто: создание нового (можно задать дату) или редактирование существующего. */
export function useEventDialog() {
  const [target, setTarget] = useState<EventDialogTarget | null>(null);

  return {
    target,
    openCreate: (defaultDate?: ISODate) => setTarget({ mode: 'create', defaultDate }),
    openEdit: (event: Event) => setTarget({ mode: 'edit', event }),
    close: () => setTarget(null),
  };
}
