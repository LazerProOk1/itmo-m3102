import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { buttonClass } from '../../components/ui/Button';
import { GithubMark } from '../../components/ui/GithubMark';
import { Modal } from '../../components/ui/Modal';
import { TelegramMark } from '../../components/ui/TelegramMark';
import { M3102_STUDENTS, type Student } from '../../data/m3102';
import { REPO_URL } from '../../services/github';
import { useQueueStore } from '../deadlines/queueStore';
import { useGroupStore } from './groupStore';
import { useProfileStore } from './profileStore';
import styles from './StudentProfile.module.css';

const SOON = '#появится после бэкенда';

/**
 * Профиль студента — одно окно на всё приложение (AppShell), открывается из «Студентов» и из очереди дедлайнов.
 * Что есть в открытых данных GitHub — уже настоящее: коммиты в репозиторий группы и места в очередях сдачи.
 * «О себе» и пройденные тесты — после бэкенда. Ссылка `#/students?u=логин` открывает профиль сразу.
 */
export function StudentProfile() {
  const login = useProfileStore((state) => state.login);
  const close = useProfileStore((state) => state.close);
  const student = login ? M3102_STUDENTS.find((item) => item.github.toLowerCase() === login.toLowerCase()) : undefined;
  // Пока окно закрывается, студент уже сброшен — показываем прошлого, иначе закрытию нечего показать
  const last = useRef(student);
  if (student) last.current = student;
  const shown = student ?? last.current;

  return (
    <Modal open={Boolean(student)} onClose={close} title={shown?.name ?? ''} description={shown?.role} size="sm">
      {shown && <ProfileBody student={shown} />}
    </Modal>
  );
}

function ProfileBody({ student }: { student: Student }) {
  const github = `https://github.com/${encodeURIComponent(student.github)}`;
  const commits = useProfileStore((state) => state.commits?.[student.github.toLowerCase()]);
  const commitsLoaded = useProfileStore((state) => state.commits !== null);
  const queues = useQueueStore((state) => state.queues);
  const queueLoaded = useQueueStore((state) => state.at > 0);
  const refreshQueues = useQueueStore((state) => state.refreshIfStale);
  const deadlines = useGroupStore((state) => state.deadlines);
  useEffect(refreshQueues, [refreshQueues]);

  // Где студент стоит: дедлайн, место и сколько всего — по порядку сроков
  const places = deadlines.flatMap((deadline) => {
    const queue = queues[deadline.id] ?? [];
    const index = queue.findIndex((entry) => entry.login?.toLowerCase() === student.github.toLowerCase());
    return index < 0 ? [] : [{ deadline, place: index + 1, total: queue.length, url: queue[index]!.url }];
  });

  return (
    <div className={styles.profile}>
      {/* Растёт, когда фото пришло: иначе анимация успевала пройти на пустом круге */}
      <img className={styles.avatar} src={`${github}.png?size=160`} alt="" onLoad={(event) => (event.currentTarget.dataset.loaded = '')} />
      <span className={styles.fact}>{student.fact}</span>

      <div className={styles.links}>
        <a className={buttonClass('secondary', 'sm')} href={github} target="_blank" rel="noopener noreferrer">
          <GithubMark size={16} />@{student.github}
        </a>
        {student.telegram && (
          <a
            className={buttonClass('secondary', 'sm')}
            href={`https://t.me/${encodeURIComponent(student.telegram)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <TelegramMark size={16} />@{student.telegram}
          </a>
        )}
        <a
          className={buttonClass('secondary', 'sm')}
          href={`${REPO_URL}/commits?author=${encodeURIComponent(student.github)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Коммиты <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </a>
      </div>

      <section className={styles.section}>
        <h3 className={styles.heading}>Активность</h3>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Коммитов в репозиторий</dt>
            <dd>{commits ?? (commitsLoaded ? 0 : '—')}</dd>
          </div>
          <div className={styles.stat}>
            <dt>В очереди сдачи</dt>
            <dd>{queueLoaded ? places.length : '—'}</dd>
          </div>
          <div className={`${styles.stat} ${styles.statSoon}`}>
            <dt>Тестов пройдено</dt>
            <dd>—</dd>
          </div>
        </dl>
        {places.length > 0 && (
          <ul className={styles.places}>
            {places.map(({ deadline, place, total, url }) => (
              <li key={deadline.id}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {deadline.name}
                </a>
                <span>
                  {place}-й из {total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>О себе</h3>
        <p className={styles.soon}>{SOON} — и пройденные тесты тоже</p>
      </section>
    </div>
  );
}
