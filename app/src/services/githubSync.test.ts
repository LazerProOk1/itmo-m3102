// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { useLectureNotesStore } from '../features/materials/lectureNotesStore';
import { blobSha, syncGithubContent } from './githubContent';

const NOTE = 'Конспекты/ДМ/Лекция_1/Графы.md';
const bytes = (text: string) => new TextEncoder().encode(text);

describe('синхронизация с GitHub', () => {
  it('blobSha совпадает с git hash-object', async () => {
    expect(await blobSha(bytes('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });

  it('неизменённый конспект второй раз не скачивается, неполное дерево — ошибка', async () => {
    const text = '# Графы\n\nТекст';
    const sha = await blobSha(bytes(text));
    let truncated = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURI(String(input));
      if (url.includes('api.github.com')) {
        const tree = url.includes('RedstoneLord') ? [{ path: NOTE, type: 'blob', sha }] : [];
        return Response.json({ truncated, tree });
      }
      if (url.endsWith('deadlines.json')) return Response.json([]);
      if (url.endsWith('.json')) return Response.json({ items: [] });
      return new Response(text);
    });
    vi.stubGlobal('fetch', fetchMock);

    await syncGithubContent();
    const raw = () => fetchMock.mock.calls.filter(([input]) => decodeURI(String(input)).endsWith('.md')).length;
    expect(raw()).toBe(1);
    expect(useLectureNotesStore.getState().lectureNotes.find((note) => note.id === `gh:${NOTE}`)?.content).toBe('Текст');

    await syncGithubContent();
    expect(raw()).toBe(1);

    truncated = true;
    await expect(syncGithubContent()).rejects.toThrow('неполный список');
    expect(useLectureNotesStore.getState().lectureNotes.find((note) => note.id === `gh:${NOTE}`)?.archived).toBe(false);
    vi.unstubAllGlobals();
  });
});
