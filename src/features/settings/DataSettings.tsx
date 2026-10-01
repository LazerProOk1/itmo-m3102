import { Download, RefreshCw, Trash, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../lib/cn';
import { STORAGE_PREFIX, storageKey } from '../../lib/storage';
import { COLLECTION_LABELS, REPOS, syncGithubContent, type SyncSummary } from '../../services/githubContent';
import { getToken, saveToken } from '../../services/github';
import { TokenFields, type TokenValue } from '../group/TokenFields';
import { SettingsRow } from './SettingsRow';
import styles from './settings.module.css';

const BACKUP_APP_ID = 'm3102';
/** Тема и режим редактирования — настройки браузера, не данные: в бэкап и сброс не входят */
const SETTINGS_KEY = storageKey('settings');

function dataKeys(): string[] {
  return Object.keys(localStorage).filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && key !== SETTINGS_KEY);
}

function exportBackup() {
  const data = Object.fromEntries(dataKeys().map((key) => [key, localStorage.getItem(key)]));
  const blob = new Blob([JSON.stringify({ app: BACKUP_APP_ID, exportedAt: new Date().toISOString(), data }, null, 2)], {
    type: 'application/json',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'm3102-backup.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importBackup(file: File) {
  let backup: { app?: unknown; data?: unknown };
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('Файл повреждён: это не корректный JSON.');
  }
  const data = backup?.data;
  if (backup?.app !== BACKUP_APP_ID || typeof data !== 'object' || data === null) {
    throw new Error('Это не файл резервной копии М3102.');
  }
  const entries = Object.entries(data).filter(
    (entry): entry is [string, string] => entry[0].startsWith(`${STORAGE_PREFIX}:`) && typeof entry[1] === 'string',
  );
  for (const key of dataKeys()) localStorage.removeItem(key);
  for (const [key, value] of entries) localStorage.setItem(key, value);
}

/** Экспорт, импорт и сброс данных (всё в localStorage браузера) + синхронизация с репозиторием группы. */
export function DataSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState('');
  const [token, setToken] = useState<TokenValue>({ token: '', remember: true });
  const [tokenSaved, setTokenSaved] = useState(() => Boolean(getToken()));

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Сбрасываем значение сразу — иначе повторный выбор того же файла не вызовет onChange
    event.target.value = '';
    if (!file) return;
    try {
      await importBackup(file);
      window.location.reload();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Не удалось прочитать файл.');
    }
  }

  function handleReset() {
    for (const key of dataKeys()) localStorage.removeItem(key);
    window.location.reload();
  }

  async function handleSyncGithub() {
    setSyncing(true);
    setSyncError('');
    setSyncResult(null);
    try {
      setSyncResult(await syncGithubContent());
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Не удалось синхронизироваться с GitHub.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <SettingsRow
        label="Синхронизировать с GitHub"
        description={`Конспекты 1 потока из ${REPOS.stream.name}, конспекты, материалы и дедлайны группы из ${REPOS.group.name}. Происходит и автоматически при открытии приложения (не чаще раза в 10 минут).`}
      >
        <Button variant="secondary" onClick={handleSyncGithub} disabled={syncing}>
          <RefreshCw size={14} strokeWidth={2} className={cn(styles.syncIcon, syncing && styles.syncIconSpinning)} aria-hidden />
          {syncing ? 'Синхронизация…' : 'Синхронизировать'}
        </Button>
      </SettingsRow>

      {syncError && <p className={styles.importError}>{syncError}</p>}

      {syncResult && (
        <div className={styles.syncResult}>
          <p className={styles.syncResultTitle}>Синхронизация завершена</p>
          <dl className={styles.syncResultStats}>
            <div>
              <dt>{COLLECTION_LABELS.stream}</dt>
              <dd>{syncResult.stream}</dd>
            </div>
            <div>
              <dt>{COLLECTION_LABELS.group}</dt>
              <dd>{syncResult.group}</dd>
            </div>
            <div>
              <dt>Описания курсов</dt>
              <dd>{syncResult.subjectInfo}</dd>
            </div>
            <div>
              <dt>Материалы</dt>
              <dd>{syncResult.materials}</dd>
            </div>
            <div>
              <dt>Дедлайны</dt>
              <dd>{syncResult.deadlines}</dd>
            </div>
          </dl>
        </div>
      )}

      <SettingsRow
        label="Токен GitHub"
        description={
          tokenSaved
            ? 'Токен сохранён: синхронизация идёт без лимита 60 запросов в час, можно публиковать ДЗ и мемы.'
            : 'Нужен, чтобы публиковать ДЗ и мемы для всей группы. Заодно снимает лимит GitHub (60 запросов в час).'
        }
      >
        <Button
          variant="secondary"
          disabled={!token.token.trim()}
          onClick={() => {
            saveToken(token.token, token.remember);
            setToken({ token: '', remember: token.remember });
            setTokenSaved(true);
          }}
        >
          Сохранить токен
        </Button>
      </SettingsRow>
      <div className={styles.tokenFields}>
        <TokenFields value={token} onChange={setToken} />
      </div>

      <SettingsRow
        label="Экспорт резервной копии"
        description="Данные хранятся только в этом браузере. Сохраните их в файл, чтобы перенести на другое устройство."
      >
        <Button variant="secondary" icon={Download} onClick={exportBackup}>
          Экспортировать
        </Button>
      </SettingsRow>

      <SettingsRow label="Импорт резервной копии" description="Заменяет текущие данные содержимым выбранного файла.">
        <Button
          variant="secondary"
          icon={Upload}
          onClick={() => {
            setImportError('');
            fileInputRef.current?.click();
          }}
        >
          Импортировать
        </Button>
        <input ref={fileInputRef} type="file" accept="application/json" className={styles.hiddenFileInput} onChange={handleFileSelected} />
      </SettingsRow>

      {importError && <p className={styles.importError}>{importError}</p>}

      <SettingsRow
        label="Сбросить данные"
        description="Удаляет ваши задачи, заметки и правки и возвращает расписание М3102 по умолчанию. Тема и режим редактирования сохранятся."
      >
        <Button variant="danger" icon={Trash} onClick={() => setConfirmingReset(true)}>
          Сбросить
        </Button>
      </SettingsRow>

      <Modal
        open={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        title="Сбросить все данные?"
        description="Будут удалены задачи, заметки, события и ручные правки. Расписание и контент группы загрузятся заново."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
              Отмена
            </Button>
            <Button variant="danger" onClick={handleReset}>
              Сбросить
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </>
  );
}
