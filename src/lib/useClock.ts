import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ISODate } from '../types/models';
import { formatTime, toISODate } from './dates';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const UPDATE_INTERVAL_MS = 30_000;

export interface Clock {
  today: ISODate;
  /** Текущее время "HH:mm" */
  time: string;
}

/**
 * Сегодняшняя дата и текущее время, обновляются раз в 30 секунд.
 * Для проверки интерфейса время можно подменить в адресе: /#/today?time=10:36
 */
export function useClock(): Clock {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), UPDATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const [searchParams] = useSearchParams();
  const override = searchParams.get('time');

  return {
    today: toISODate(now),
    time: override && TIME_PATTERN.test(override) ? override : formatTime(now),
  };
}
