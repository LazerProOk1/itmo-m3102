import { ArrowLeft, ArrowRight, ArrowUpRight, GitCommitHorizontal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button, buttonClass } from '../../components/ui/Button';
import { GithubMark } from '../../components/ui/GithubMark';
import { Modal } from '../../components/ui/Modal';
import { TelegramMark } from '../../components/ui/TelegramMark';
import { M3102_STUDENTS, type Student } from '../../data/m3102';
import { formatDayLabel, toISODate } from '../../lib/dates';
import { REPO_URL } from '../../services/github';
import { useQueueStore } from '../deadlines/queueStore';
import { useGroupStore } from './groupStore';
import { useProfileStore } from './profileStore';
import styles from './StudentProfile.module.css';

const SOON = '#появится после бэкенда';

/**
 * Профиль студента — одно окно на всё приложение (AppShell), открывается из «Студентов» и из очереди дедлайнов.
 * Что есть в открытых данных GitHub — уже настоящее: коммиты, последние правки и места в очередях сдачи.
 * «О себе» и пройденные тесты — после бэкенда. ← / → и кнопки внизу листают группу, не закрывая окно.
 */
export function StudentProfile() {
  const login = useProfileStore((state) => state.login);
  const close = useProfileStore((state) => state.close);
  const open = useProfileStore((state) => state.open);
  const index = login ? M3102_STUDENTS.findIndex((item) => item.github.toLowerCase() === login.toLowerCase()) : -1;
  const student = M3102_STUDENTS[index];
  // Пока окно закрывается, студент уже сброшен — показываем прошлого, иначе закрытию нечего показать
  const last = useRef(student);
  if (student) last.current = student;
  const shown = student ?? last.current;
  const neighbour = (step: number) => M3102_STUDENTS[(index + step + M3102_STUDENTS.length) % M3102_STUDENTS.length]!;

  useEffect(() => {
    if (index < 0) return undefined;
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
      open(M3102_STUDENTS[(index + (event.key === 'ArrowRight' ? 1 : -1) + M3102_STUDENTS.length) % M3102_STUDENTS.length]!.github);
    }
    addEventListener('keydown', handleKey);
    return () => removeEventListener('keydown', handleKey);
  }, [index, open]);

  return (
    <Modal
      open={Boolean(student)}
      onClose={close}
      title="Профиль студента"
      size="sm"
      footer={
        student && (
          <div className={styles.pager}>
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => open(neighbour(-1).github)}>
              {shortName(neighbour(-1))}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => open(neighbour(1).github)}>
              {shortName(neighbour(1))}
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </Button>
          </div>
        )
      }
    >
      {shown && <ProfileBody key={shown.github} student={shown} />}
    </Modal>
  );
}

/** «Гулякин Илья Александрович» → «Илья Гулякин» */
const shortName = (student: Student) => {
  const [last, first] = student.name.split(' ');
  return first ? `${first} ${last}` : student.name;
};

function ProfileBody({ student }: { student: Student }) {
  const login = student.github.toLowerCase();
  const github = `https://github.com/${encodeURIComponent(student.github)}`;
  const commits = useProfileStore((state) => state.commits?.[login]);
  const commitsLoaded = useProfileStore((state) => state.commits !== null);
  const recent = useProfileStore((state) => state.recent[login]?.data);
  const error = useProfileStore((state) => state.error);
  const queues = useQueueStore((state) => state.queues);
  const queueLoaded = useQueueStore((state) => state.at > 0);
  const refreshQueues = useQueueStore((state) => state.refreshIfStale);
  const deadlines = useGroupStore((state) => state.deadlines);
  useEffect(refreshQueues, [refreshQueues]);
  const today = toISODate(new Date());

  // Где студент стоит: дедлайн, место и сколько всего — по порядку сроков
  const places = deadlines.flatMap((deadline) => {
    const queue = queues[deadline.id] ?? [];
    const index = queue.findIndex((entry) => entry.login?.toLowerCase() === login);
    return index < 0 ? [] : [{ deadline, place: index + 1, total: queue.length, url: queue[index]!.url }];
  });

  return (
    <div className={styles.profile}>
      <div className={styles.head}>
        {/* Растёт, когда фото пришло: иначе анимация успевала пройти на пустом круге */}
        <img className={styles.avatar} src={`${github}.png?size=200`} alt="" onLoad={(event) => (event.currentTarget.dataset.loaded = '')} />
        <div className={styles.who}>
          <h3 className={styles.name}>{student.name}</h3>
          <span className={styles.login}>@{student.github}</span>
          <span className={styles.chips}>
            <span className={styles.fact}>{student.fact}</span>
            {student.role && <span className={styles.role}>{student.role}</span>}
          </span>
        </div>
      </div>

      <div className={styles.links}>
        <a className={buttonClass('secondary', 'sm')} href={github} target="_blank" rel="noopener noreferrer">
          <GithubMark size={16} />
          GitHub
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
          <ul className={styles.rows}>
            {places.map(({ deadline, place, total, url }) => (
              <li key={deadline.id}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <span className={styles.rowText}>{deadline.name}</span>
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
        <h3 className={styles.heading}>Последние правки в репозитории группы</h3>
        {recent?.length ? (
          <ul className={styles.rows}>
            {recent.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <GitCommitHorizontal size={14} strokeWidth={1.75} aria-hidden />
                  <span className={styles.rowText}>{item.message}</span>
                </a>
                <span>{item.date && formatDayLabel(toISODate(new Date(item.date)), today).toLowerCase()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>{recent ? 'Пока ничего не добавлял.' : error ? 'Не загрузились.' : 'Загружаются…'}</p>
        )}
        <a
          className={styles.more}
          href={`${REPO_URL}/commits?author=${encodeURIComponent(student.github)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Все коммиты <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden />
        </a>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>О себе</h3>
        <p className={styles.soon}>{SOON} — и пройденные тесты тоже</p>
      </section>

      {error && <p className={styles.stale}>Показаны сохранённые данные: {error}.</p>}
    </div>
  );
}
