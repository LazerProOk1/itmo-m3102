const owner = 'RedstoneLord', repo = 'itmo-m3102', branch = 'master';
const tokenKey = 'm3102-github-token-v1';
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

export function getToken() {
  try { return sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey) || ''; } catch { return ''; }
}
export function saveToken(token, remember = false) {
  const value = String(token || '').trim();
  if (!value) return;
  try { (remember ? localStorage : sessionStorage).setItem(tokenKey, value); (remember ? sessionStorage : localStorage).removeItem(tokenKey); } catch { /* Приватный режим. */ }
}
export function forgetToken() {
  try { sessionStorage.removeItem(tokenKey); localStorage.removeItem(tokenKey); } catch { /* Приватный режим. */ }
}
export const utf8Base64 = text => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
export const base64Utf8 = encoded => {
  const binary = atob(encoded.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
};
export async function githubFetch(url, options = {}) {
  const token = getToken();
  return fetch(url, { ...options, headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
}
export function githubError(status) {
  if (status === 401) return 'Токен неверен или срок его действия истёк.';
  if (status === 403) return 'Нет прав на запись или достигнут лимит GitHub API.';
  if (status === 404) return 'Репозиторий, ветка или файл недоступны.';
  if (status === 409 || status === 422) return 'Файл изменился на GitHub. Загрузите свежую версию и повторите попытку.';
  return `GitHub ответил с ошибкой ${status}.`;
}
export async function readRepoFile(path) {
  const url = `${apiBase}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`;
  const response = await githubFetch(url);
  if (!response.ok) throw new Error(githubError(response.status));
  const file = await response.json();
  if (!file.sha || !file.content) throw new Error('GitHub не вернул содержимое файла.');
  return { sha: file.sha, text: base64Utf8(file.content) };
}
export async function readRepoFileOptional(path) {
  const url = `${apiBase}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`;
  const response = await githubFetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(githubError(response.status));
  const file = await response.json();
  return { sha: file.sha, text: file.content ? base64Utf8(file.content) : '' };
}
// Возвращает только sha файла — не декодирует содержимое (нужно для бинарных файлов вроде картинок).
export async function readRepoFileMeta(path) {
  const url = `${apiBase}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`;
  const response = await githubFetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(githubError(response.status));
  const file = await response.json();
  return file.sha ? { sha: file.sha } : null;
}
export async function writeRepoFileBase64(path, content, message, sha) {
  if (!getToken()) throw new Error('Для сохранения в GitHub нужен токен.');
  const url = `${apiBase}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const response = await githubFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, content, ...(sha ? { sha } : {}), branch }) });
  if (!response.ok) throw new Error(githubError(response.status));
  return response.json();
}
export async function writeRepoFile(path, content, message, sha) {
  return writeRepoFileBase64(path, utf8Base64(content), message, sha);
}
export async function deleteRepoFile(path, message, sha) {
  if (!getToken()) throw new Error('Для удаления нужен токен.');
  const url = `${apiBase}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const response = await githubFetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, sha, branch }) });
  if (!response.ok) throw new Error(githubError(response.status));
  return response.json();
}
export const repoEditUrl = path => `https://github.com/${owner}/${repo}/edit/${branch}/${path.split('/').map(encodeURIComponent).join('/')}`;

// Изменённые локально записи побеждают, чужие записи с сервера сохраняются.
export function mergeHomework(base, remote, local) {
  const before = new Map(base.items.map(item => [item.id, item]));
  const desired = new Map(local.items.map(item => [item.id, item]));
  const result = new Map(remote.items.map(item => [item.id, item]));
  for (const [id, item] of desired) if (JSON.stringify(item) !== JSON.stringify(before.get(id))) result.set(id, item);
  for (const id of before.keys()) if (!desired.has(id)) result.delete(id);
  return { version: 1, items: [...result.values()] };
}
