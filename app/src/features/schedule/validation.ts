/** Текст ошибки или undefined, если время указано верно */
export function checkTimeRange(startTime: string, endTime: string): string | undefined {
  if (!startTime || !endTime) return 'Укажите время начала и окончания.';
  if (endTime <= startTime) return 'Время окончания должно быть позже времени начала.';
  return undefined;
}
