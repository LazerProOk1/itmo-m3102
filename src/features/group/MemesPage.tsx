import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field } from '../../components/ui/Field';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { deleteRepoFile, getToken, groupRawUrl, readRepoFile, saveToken, writeRepoFile, writeRepoFileBase64 } from '../../services/github';
import { useEditMode } from '../settings/EditModeContext';
import { TokenFields, type TokenValue } from './TokenFields';
import groupStyles from './group.module.css';
import styles from './MemesPage.module.css';

interface Meme {
  id: string;
  file: string;
  title: string;
  uploader: string;
  createdAt: string;
}

const MEMES_PATH = 'data/memes.json';
const MAX_BYTES = 4 * 1024 * 1024;
const NAME_KEY = 'm3102-meme-name-v1';

function parseMemes(raw: unknown): Meme[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.id && item?.file)
    .map((item) => ({
      id: String(item.id),
      file: String(item.file),
      title: String(item.title ?? ''),
      uploader: String(item.uploader ?? ''),
      createdAt: String(item.createdAt ?? ''),
    }));
}

const serialize = (items: Meme[]) => JSON.stringify({ version: 1, items }, null, 2) + '\n';

/** Свежий список прямо из Contents API (с sha) — чтобы не затереть мем, добавленный кем-то только что */
async function readMemes(): Promise<{ items: Meme[]; sha?: string }> {
  const remote = await readRepoFile(MEMES_PATH);
  return remote ? { items: parseMemes(JSON.parse(remote.text)), sha: remote.sha } : { items: [] };
}

/** Мемы группы — общая коллекция в репозитории (img/memes + data/memes.json), как на сайте M3102. */
export function MemesPage() {
  const { isEditMode } = useEditMode();
  const [memes, setMemes] = useState<Meme[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Meme | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<Meme | null>(null);

  useEffect(() => {
    fetch(groupRawUrl(MEMES_PATH), { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((raw) => setMemes(parseMemes(raw)))
      .catch(() => setError('Не удалось загрузить мемы.'));
  }, []);

  async function remove(meme: Meme) {
    setDeleting(null);
    if (!getToken()) return setError('Для удаления нужен токен GitHub — добавьте его в окне «Добавить мем».');
    try {
      const image = await readRepoFile(meme.file);
      if (image) await deleteRepoFile(meme.file, `Мемы: удалить ${meme.title || meme.id}`, image.sha);
      const current = await readMemes();
      const items = current.items.filter((item) => item.id !== meme.id);
      await writeRepoFile(MEMES_PATH, serialize(items), `Мемы: удалить ${meme.title || meme.id}`, current.sha);
      setMemes(items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось удалить мем.');
    }
  }

  const sorted = [...(memes ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader
        title="Мемы"
        subtitle="Общая коллекция группы. Новые появятся у всех после сохранения в GitHub."
        actions={
          isEditMode && (
            <Button variant="primary" icon={Plus} onClick={() => setUploading(true)}>
              Добавить мем
            </Button>
          )
        }
      />

      {error && <p className={styles.error}>{error}</p>}

      {memes === null ? (
        !error && <p className={styles.loading}>Загрузка…</p>
      ) : sorted.length === 0 ? (
        <EmptyState title="Мемов пока нет" description="Загрузите первый — кнопка выше." />
      ) : (
        <div className={`${styles.grid} stagger`}>
          {sorted.map((meme) => (
            <figure key={meme.id} className={styles.card}>
              <button type="button" className={styles.image} onClick={() => setOpen(meme)}>
                <img src={groupRawUrl(meme.file)} alt={meme.title || 'Мем'} loading="lazy" />
              </button>
              {isEditMode && (
                <IconButton icon={X} label="Удалить мем" size="sm" className={styles.delete} onClick={() => setDeleting(meme)} />
              )}
              {(meme.title || meme.uploader) && (
                <figcaption>
                  {meme.title && <strong>{meme.title}</strong>}
                  <small>
                    {[meme.uploader, meme.createdAt && new Date(meme.createdAt).toLocaleDateString('ru-RU')].filter(Boolean).join(' · ')}
                  </small>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      <Modal open={open !== null} onClose={() => setOpen(null)} title={open?.title || 'Мем'} size="lg">
        {open && <img className={styles.full} src={groupRawUrl(open.file)} alt={open.title || 'Мем'} />}
      </Modal>
      <UploadMemeDialog open={uploading} onClose={() => setUploading(false)} onUploaded={setMemes} />
      <ConfirmDeleteModal
        open={deleting !== null}
        title="Удалить этот мем для всей группы?"
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
      />
    </>
  );
}

const FORM_ID = 'meme-upload-form';

function UploadMemeDialog({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: (items: Meme[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploader, setUploader] = useState('');
  const [token, setToken] = useState<TokenValue>({ token: '', remember: false });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setTitle('');
    setUploader(localStorage.getItem(NAME_KEY) ?? '');
    setToken({ token: '', remember: false });
    setStatus('');
  }, [open]);

  async function upload() {
    if (!file) return setStatus('Выберите изображение.');
    if (!file.type.startsWith('image/')) return setStatus('Нужен файл изображения.');
    if (file.size > MAX_BYTES) return setStatus('Файл слишком большой (максимум 4 МБ).');
    if (token.token.trim()) saveToken(token.token, token.remember);
    if (!getToken()) return setStatus('Введите токен с правом Contents: Read and write.');
    if (uploader.trim()) localStorage.setItem(NAME_KEY, uploader.trim());

    setBusy(true);
    setStatus('Загружаем изображение…');
    try {
      const id = crypto.randomUUID();
      const ext = (/\/(\w+)/.exec(file.type)?.[1] ?? 'png').replace('jpeg', 'jpg');
      const path = `img/memes/${id}.${ext}`;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await writeRepoFileBase64(path, dataUrl.split(',')[1] ?? '', `Мемы: добавить ${title.trim() || id}`);
      setStatus('Обновляем список…');
      const current = await readMemes();
      const items = [
        ...current.items,
        { id, file: path, title: title.trim(), uploader: uploader.trim(), createdAt: new Date().toISOString() },
      ];
      await writeRepoFile(MEMES_PATH, serialize(items), `Мемы: добавить ${title.trim() || id}`, current.sha);
      onUploaded(items);
      setStatus('Мем добавлен.');
      setTimeout(onClose, 900);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Не удалось загрузить мем.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить мем"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={busy}>
            Загрузить
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void upload();
        }}
      >
        <Field label="Изображение" htmlFor="meme-file" hint="До 4 МБ">
          <input id="meme-file" type="file" accept="image/*" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Подпись" htmlFor="meme-title" optional>
          <Input id="meme-title" maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Ваше имя" htmlFor="meme-uploader" optional>
          <Input id="meme-uploader" maxLength={60} value={uploader} onChange={(event) => setUploader(event.target.value)} />
        </Field>
        <TokenFields value={token} onChange={setToken} />
        {status && (
          <p className={groupStyles.status} aria-live="polite">
            {status}
          </p>
        )}
      </form>
    </Modal>
  );
}
