/**
 * GitHub REST API для репозитория группы — как на сайте M3102: чтение/запись файлов через Contents API
 * с fine-grained PAT пользователя. Токен не попадает в адрес страницы и в JSON: по умолчанию живёт
 * только во вкладке (sessionStorage), «Запомнить» переносит его в localStorage.
 */
export const GROUP_REPO = { owner: 'RedstoneLord', repo: 'itmo-m3102', branch: 'master' } as const;

const TOKEN_KEY = 'm3102-github-token-v1';
const API_BASE = `https://api.github.com/repos/${GROUP_REPO.owner}/${GROUP_REPO.repo}`;

export const encodeRepoPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
export const groupRawUrl = (path: string) =>
  `https://raw.githubusercontent.com/${GROUP_REPO.owner}/${GROUP_REPO.repo}/${GROUP_REPO.branch}/${encodeRepoPath(path)}`;
export const repoEditUrl = (path: string) =>
  `https://github.com/${GROUP_REPO.owner}/${GROUP_REPO.repo}/edit/${GROUP_REPO.branch}/${encodeRepoPath(path)}`;
export const REPO_URL = `https://github.com/${GROUP_REPO.owner}/${GROUP_REPO.repo}`;
export const PAT_URL = 'https://github.com/settings/personal-access-tokens/new';

export function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function saveToken(token: string, remember: boolean): void {
  const value = token.trim();
  if (!value) return;
  try {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, value);
    (remember ? sessionStorage : localStorage).removeItem(TOKEN_KEY);
  } catch {
    // Приватный режим — токен просто не сохранится
  }
}

export function forgetToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Приватный режим
  }
}

/** fetch к api.github.com — с токеном, если он есть (лимит 5000 запросов/час вместо 60) */
export function githubFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(url, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
}

export function githubError(status: number): string {
  if (status === 401) return 'Токен неверен или срок его действия истёк.';
  if (status === 403 || status === 429) return 'Нет прав на запись или достигнут лимит GitHub API (60 запросов в час без токена).';
  if (status === 404) return 'Репозиторий, ветка или файл недоступны.';
  if (status === 409 || status === 422) return 'Файл изменился на GitHub. Загрузите свежую версию и повторите попытку.';
  return `GitHub ответил с ошибкой ${status}.`;
}

export function utf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function base64Utf8(encoded: string): string {
  const binary = atob(encoded.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

const contentsUrl = (path: string) => `${API_BASE}/contents/${encodeRepoPath(path)}`;

/** Текущее содержимое и sha файла; null — файла нет */
export async function readRepoFile(path: string): Promise<{ sha: string; text: string } | null> {
  const response = await githubFetch(`${contentsUrl(path)}?ref=${GROUP_REPO.branch}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(githubError(response.status));
  const file = (await response.json()) as { sha: string; content?: string };
  return { sha: file.sha, text: file.content ? base64Utf8(file.content) : '' };
}

export async function writeRepoFileBase64(path: string, base64: string, message: string, sha?: string): Promise<void> {
  if (!getToken()) throw new Error('Для сохранения в GitHub нужен токен.');
  const response = await githubFetch(contentsUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: base64, branch: GROUP_REPO.branch, ...(sha ? { sha } : {}) }),
  });
  if (!response.ok) throw new Error(githubError(response.status));
}

export const writeRepoFile = (path: string, text: string, message: string, sha?: string) =>
  writeRepoFileBase64(path, utf8Base64(text), message, sha);

export async function deleteRepoFile(path: string, message: string, sha: string): Promise<void> {
  if (!getToken()) throw new Error('Для удаления нужен токен.');
  const response = await githubFetch(contentsUrl(path), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: GROUP_REPO.branch }),
  });
  if (!response.ok) throw new Error(githubError(response.status));
}
