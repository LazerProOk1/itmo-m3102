/**
 * Альбом «Колючего куша» (ключ m3102-slots-v1 общий с сайтом группы: тот же origin): что выпало из капсул.
 * Только чтение; нет данных или хранилище закрыто — пусто.
 */
export function slotsAlbum(): Record<string, number> {
  try {
    const album = (JSON.parse(localStorage.getItem('m3102-slots-v1') ?? 'null') as { album?: unknown } | null)?.album;
    return album && typeof album === 'object' ? (album as Record<string, number>) : {};
  } catch {
    return {};
  }
}
