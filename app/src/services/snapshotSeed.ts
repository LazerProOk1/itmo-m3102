import { parseDeadlines, parseLinks, useGroupStore } from '../features/group/groupStore';
import { parseHomework, useHomeworkStore } from '../features/homework/homeworkStore';
import { applyGroupSchedule } from './githubContent';
import { parseGroupSchedule } from './groupSchedule';

/** Файлы группы в том виде, как их отдаёт GitHub (и как лежат в снимке при сборке) */
export interface GroupFiles {
  deadlines: unknown;
  homework: unknown;
  links: unknown;
  schedule: unknown;
}

/**
 * Кладёт в приложение то, что есть в снимке. Каждый файл независим: сломанный пропускается, остальные применяются.
 * Возвращает, сколько файлов применилось.
 */
export function applySnapshot(files: GroupFiles): number {
  const steps: (() => void)[] = [
    () => useGroupStore.setState({ deadlines: parseDeadlines(files.deadlines) }),
    () => useGroupStore.setState({ links: parseLinks(files.links) }),
    () => useHomeworkStore.getState().setRemote(parseHomework(files.homework)),
    () => applyGroupSchedule(parseGroupSchedule(files.schedule)),
  ];
  let applied = 0;
  for (const step of steps) {
    try {
      step();
      applied++;
    } catch {
      // Формат файла поменялся — этот кусок дождётся настоящей синхронизации
    }
  }
  return applied;
}

/**
 * Первое открытие (успешной синхронизации ещё не было): дедлайны, ДЗ, ссылки и расписание — из снимка при сборке, а не пустые экраны
 * и не устаревшее запасное расписание. Лимит GitHub и нет сети больше не оставляют страницу пустой. Подгружается отдельным куском.
 */
export async function seedFromSnapshot(): Promise<void> {
  const { default: snapshot } = await import('virtual:group-snapshot');
  applySnapshot(snapshot);
}
