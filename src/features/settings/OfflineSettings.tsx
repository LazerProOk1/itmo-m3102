import { CloudDownload, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { pluralize } from '../../lib/pluralize';
import { offlinePlan, useOfflineStore } from '../../services/offline';
import { useGroupStore } from '../group/groupStore';
import { SettingsRow } from './SettingsRow';
import styles from './settings.module.css';

const FILE_FORMS: [string, string, string] = ['файл', 'файла', 'файлов'];
const ON_OFF = [
  { value: 'on', label: 'Вкл' },
  { value: 'off', label: 'Выкл' },
] as const;

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: bytes < 10 * 1024 * 1024 ? 1 : 0 })} МБ`;

/** Сколько места занято и доступно сайту — меняется после скачивания и очистки */
function useStorageEstimate(deps: unknown) {
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then(({ usage = 0, quota = 0 }) => setEstimate({ usage, quota }))
      .catch(() => undefined);
  }, [deps]);
  return estimate;
}

/** «Работа без интернета»: всё нужное для конспектов — на устройство одной кнопкой, как на сайте группы */
export function OfflineSettings() {
  const files = useGroupStore((state) => state.files);
  const { saved, auto, status, progress, error, setAuto, download, clear } = useOfflineStore();
  const savedCount = Object.keys(saved).length;
  const plan = offlinePlan(files, saved);
  const savedBytes = plan.wanted.filter((file) => saved[file.path]).reduce((sum, file) => sum + file.size, 0);
  const missingBytes = plan.missing.reduce((sum, file) => sum + file.size, 0);
  const estimate = useStorageEstimate(savedCount + status);
  const running = status === 'running';
  const upToDate = savedCount > 0 && plan.missing.length === 0 && plan.stale.length === 0;

  const state = running
    ? `Скачано ${progress?.files ?? 0} из ${pluralize(progress?.totalFiles ?? 0, FILE_FORMS)} · ${mb(progress?.bytes ?? 0)} из ${mb(progress?.totalBytes ?? 0)}`
    : savedCount > 0
      ? `Сохранено ${pluralize(savedCount, FILE_FORMS)}, ${mb(savedBytes)}${upToDate ? ' — всё актуально' : ` · новых и изменённых: ${plan.missing.length} (${mb(missingBytes)})`}.`
      : files.length === 0
        ? 'Сначала синхронизируйтесь с GitHub — так сайт узнает, какие файлы есть у группы.'
        : `Конспекты и PDF пока не сохранены: ${pluralize(plan.missing.length, FILE_FORMS)}, ${mb(missingBytes)}.`;

  return (
    <>
      <SettingsRow
        label="Работа без интернета"
        description={`PDF и картинки конспектов, учебники и лабораторные группы — на это устройство, читалка PDF и схемы — тоже. Тексты конспектов, расписание и ДЗ сохраняются и так. Аудио, docx и djvu не сохраняются. ${state}`}
      >
        <div className={styles.offlineButtons}>
          {savedCount > 0 && !running && (
            <Button variant="ghost" icon={Trash} onClick={() => void clear()}>
              Очистить
            </Button>
          )}
          <Button variant="secondary" icon={CloudDownload} disabled={running || files.length === 0 || upToDate} onClick={() => void download()}>
            {running ? 'Скачивание…' : savedCount > 0 ? 'Обновить' : 'Скачать всё'}
          </Button>
        </div>
      </SettingsRow>

      {running && progress && (
        <progress
          className={styles.offlineProgress}
          value={progress.bytes}
          max={progress.totalBytes || 1}
          aria-label="Скачивание для работы без интернета"
        />
      )}
      {error && <p className={styles.importError}>{error}</p>}
      {estimate && estimate.quota > 0 && (
        <p className={styles.offlineUsage}>
          На устройстве занято {mb(estimate.usage)} из {mb(estimate.quota)}.
        </p>
      )}

      <SettingsRow label="Обновлять автоматически" description="После каждой синхронизации докачивать новые и изменённые файлы и удалять пропавшие.">
        <SegmentedControl
          label="Обновлять автоматически"
          options={[...ON_OFF]}
          value={auto ? 'on' : 'off'}
          onChange={(value) => setAuto(value === 'on')}
        />
      </SettingsRow>
    </>
  );
}
