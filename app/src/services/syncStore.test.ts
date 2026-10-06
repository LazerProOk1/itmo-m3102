// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sync = vi.fn();
vi.mock('./githubContent', () => ({ syncGithubContent: () => sync(), autoSyncGithubContent: () => sync() }));

const { useSyncStore } = await import('./syncStore');

describe('syncStore', () => {
  beforeEach(() => {
    sync.mockReset();
    useSyncStore.setState({ status: 'idle', summary: null, error: '' });
  });

  it('кнопка + автосинхронизация одновременно — запрос к GitHub один', async () => {
    let finish!: (value: unknown) => void;
    sync.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const first = useSyncStore.getState().run();
    const second = useSyncStore.getState().runAuto();
    expect(useSyncStore.getState().status).toBe('syncing');
    finish({ notes: 1 });
    await Promise.all([first, second]);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState()).toMatchObject({ status: 'done', summary: { notes: 1 } });
  });

  it('fetch без сети (TypeError) — понятный текст, а не «Failed to fetch»', async () => {
    sync.mockRejectedValue(new TypeError('Failed to fetch'));
    await useSyncStore.getState().run();
    expect(useSyncStore.getState().status).toBe('error');
    expect(useSyncStore.getState().error).toMatch(/Нет интернета/);
  });

  it('нет сети заранее — GitHub не трогаем', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await useSyncStore.getState().run();
    expect(sync).not.toHaveBeenCalled();
    expect(useSyncStore.getState().error).toMatch(/Нет интернета/);
    vi.restoreAllMocks();
  });
});
