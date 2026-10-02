import { GitBranch } from 'lucide-react';
import styles from './GithubSourceBadge.module.css';

/**
 * Маленькая иконка рядом с названием конспекта/материала, пришедшего из GitHub-синхронизации
 * (PROMPT 25) — напоминает, что ручные правки перезапишутся при следующей синхронизации файла.
 * Lucide в установленной версии не поставляет брендовую иконку Github — берём GitBranch
 * как ближайший по смыслу «из git-репозитория» символ.
 */
export function GithubSourceBadge() {
  return (
    <span className={styles.icon} title="Синхронизировано из GitHub — изменения могут быть перезаписаны при следующей синхронизации">
      <GitBranch size={12} strokeWidth={1.75} aria-label="Синхронизировано из GitHub" />
    </span>
  );
}
