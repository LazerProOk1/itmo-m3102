import { ArrowLeft, Download, Printer } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Markdown } from '../../components/markdown/Markdown';
import { Button, buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { groupRawUrl } from '../../services/github';
import { isHiddenPath, useGroupStore, type RepoFile } from './groupStore';
import styles from './RepoFilePage.module.css';

const PdfViewer = lazy(() => import('../materials/PdfViewer').then((module) => ({ default: module.PdfViewer })));

/** Подписи разделов корня — как на сайте группы */
const SUBTITLES: Record<string, string> = {
  Конспекты: 'Конспекты лекций и практик по предметам',
  'Записи лекций': 'Аудиозаписи лекций',
  Лабораторные: 'Лабораторные работы и отчёты по ним',
  Материалы: 'Учебники и вспомогательные материалы',
};

const EXT_LABELS: Record<string, string> = { pdf: 'PDF', docx: 'DOC', doc: 'DOC', md: 'MD', html: 'WEB', htm: 'WEB', mp3: 'MP3', wav: 'WAV', djvu: 'DJVU', txt: 'TXT' };

const extension = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1_048_576).toFixed(1)} МБ`;
}

export const filePath = (path: string) => `/files/${path.split('/').map(encodeURIComponent).join('/')}`;

/** Папки и файлы, лежащие прямо внутри `folder` */
export function listFolder(files: RepoFile[], folder: string): { folders: string[]; files: RepoFile[] } {
  const prefix = folder ? `${folder}/` : '';
  const folders = new Set<string>();
  const direct: RepoFile[] = [];
  for (const file of files) {
    if (!file.path.startsWith(prefix) || isHiddenPath(file.path)) continue;
    const rest = file.path.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash === -1) direct.push(file);
    else folders.add(rest.slice(0, slash));
  }
  return {
    folders: [...folders].sort((a, b) => a.localeCompare(b, 'ru')),
    files: direct.sort((a, b) => a.path.localeCompare(b.path, 'ru')),
  };
}

/**
 * Файлы группы — браузер по репозиторию RedstoneLord/itmo-m3102, как «Материалы» на их сайте:
 * разделы → предметы → файлы. PDF и .md открываются прямо здесь, остальное — скачать.
 */
export function RepoFilePage() {
  const splat = useParams()['*'] ?? '';
  const path = splat.replace(/\/$/, '');
  const files = useGroupStore((state) => state.files);
  const file = files.find((entry) => entry.path === path);

  return file ? <FileView file={file} /> : <FolderView files={files} folder={path} />;
}

function Breadcrumbs({ path }: { path: string }) {
  const parts = path ? path.split('/') : [];
  return (
    <nav className={styles.crumbs} aria-label="Путь">
      <Link to="/files">Файлы группы</Link>
      {parts.map((part, index) => (
        <span key={index}>
          {' / '}
          <Link to={filePath(parts.slice(0, index + 1).join('/'))}>{part}</Link>
        </span>
      ))}
    </nav>
  );
}

/** Корень репозитория — вкладка «Файлы группы» в «Материалах» */
export function GroupFilesRoot() {
  const files = useGroupStore((state) => state.files);
  return <FolderView files={files} folder="" embedded />;
}

function FolderView({ files, folder, embedded = false }: { files: RepoFile[]; folder: string; embedded?: boolean }) {
  const listing = listFolder(files, folder);
  const isRoot = folder === '';

  return (
    <>
      {isRoot && !embedded && (
        <PageHeader
          title="Материалы группы М3102"
          subtitle="Конспекты, записи лекций, лабораторные и учебники. Выберите раздел, затем — предмет и файл. PDF и конспекты .md открываются прямо здесь."
        />
      )}
      {!embedded && <Breadcrumbs path={folder} />}

      {listing.folders.length === 0 && listing.files.length === 0 ? (
        <EmptyState title={files.length ? 'Папка пуста' : 'Файлы ещё не загружены'} description={files.length ? undefined : 'Они появятся после синхронизации с GitHub.'} />
      ) : (
        <div className={styles.grid}>
          {listing.folders.map((name) => (
            <Link key={name} className={styles.card} to={filePath(folder ? `${folder}/${name}` : name)}>
              <span className={styles.icon}>↗</span>
              <span className={styles.meta}>
                <span className={styles.name}>{name}</span>
                <span className={styles.desc}>{isRoot ? (SUBTITLES[name] ?? 'Папка') : 'Папка'}</span>
              </span>
            </Link>
          ))}
          {isRoot && (
            <Link className={styles.card} to="/deadlines">
              <span className={styles.icon}>ДД</span>
              <span className={styles.meta}>
                <span className={styles.name}>Дедлайны</span>
                <span className={styles.desc}>Сроки сдачи и важные даты</span>
              </span>
            </Link>
          )}
          {listing.files.map((entry) => {
            const name = entry.path.slice(entry.path.lastIndexOf('/') + 1);
            const ext = extension(name);
            const readable = ext === 'pdf' || ext === 'md';
            const body = (
              <>
                <span className={styles.icon}>{EXT_LABELS[ext] ?? 'ФАЙЛ'}</span>
                <span className={styles.meta}>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.desc}>
                    {formatSize(entry.size)}
                    {ext === 'pdf' && ' · читать в браузере'}
                    {ext === 'md' && ' · читать конспект'}
                  </span>
                </span>
              </>
            );
            return readable ? (
              <Link key={entry.path} className={styles.card} to={filePath(entry.path)}>
                {body}
              </Link>
            ) : (
              <a key={entry.path} className={styles.card} href={groupRawUrl(entry.path)} target="_blank" rel="noopener noreferrer" download>
                {body}
                <Download size={14} strokeWidth={1.75} className={styles.download} aria-label="Скачать" />
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}

function FileView({ file }: { file: RepoFile }) {
  const navigate = useNavigate();
  const name = file.path.slice(file.path.lastIndexOf('/') + 1);
  const ext = extension(name);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ext !== 'md') return;
    setText(null);
    fetch(groupRawUrl(file.path))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(setText)
      .catch((reason: Error) => setError(`Не удалось загрузить файл (${reason.message}).`));
  }, [ext, file.path]);

  return (
    <div className={styles.view}>
      <Breadcrumbs path={file.path} />
      <div className={styles.viewbar}>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>
          Назад
        </Button>
        <span className={styles.viewname}>{name}</span>
        {ext === 'md' && (
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Скачать PDF
          </Button>
        )}
        <a className={buttonClass('secondary', 'md')} href={groupRawUrl(file.path)} target="_blank" rel="noopener noreferrer" download>
          <Download size={14} strokeWidth={1.75} aria-hidden />
          Скачать
        </a>
      </div>

      {ext === 'pdf' ? (
        <Suspense fallback={<p className={styles.state}>Загрузка PDF…</p>}>
          <PdfViewer file={groupRawUrl(file.path)} />
        </Suspense>
      ) : ext === 'md' ? (
        error ? (
          <p className={styles.state}>{error}</p>
        ) : text === null ? (
          <p className={styles.state}>Загрузка…</p>
        ) : (
          <Markdown content={text} sourceRef={file.path} className={styles.prose} />
        )
      ) : (
        <p className={styles.state}>Этот файл нельзя открыть в браузере — скачайте его.</p>
      )}
    </div>
  );
}
