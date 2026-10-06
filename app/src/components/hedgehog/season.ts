import type { ISODate } from '../../types/models';

export type Season = 'newyear' | 'halloween' | 'knowledge';

/**
 * Редкая сезонная деталь у ёжика: новогодняя шапка (20 дек — 10 янв), тыква на Хэллоуин (29 окт — 1 ноя),
 * шапочка выпускника на День знаний (1–3 сен). В остальные дни — без украшений: деталь замечают, потому что она редкая.
 */
export function seasonOf(date: ISODate): Season | null {
  const monthDay = date.slice(5);
  if (monthDay >= '12-20' || monthDay <= '01-10') return 'newyear';
  if (monthDay >= '10-29' && monthDay <= '11-01') return 'halloween';
  if (monthDay >= '09-01' && monthDay <= '09-03') return 'knowledge';
  return null;
}
