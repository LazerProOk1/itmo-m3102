/** Сохраняет blob файлом через временную ссылку */
export function saveBlob(blob: Blob, name: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Скачивает файл с другого сайта. Атрибут download у чужих ссылок браузер игнорирует и просто
 * открывает PDF во вкладке, поэтому сначала забираем файл (raw.githubusercontent отдаёт CORS).
 */
export async function downloadUrl(url: string, name: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  saveBlob(await response.blob(), name);
}
