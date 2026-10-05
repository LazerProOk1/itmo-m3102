import { ArrowUpRight, Send } from 'lucide-react';
import { useRef } from 'react';
import { GithubMark } from '../../components/ui/GithubMark';
import { Modal } from '../../components/ui/Modal';
import type { Student } from '../../data/m3102';
import { REPO_URL } from '../../services/github';
import styles from './StudentProfile.module.css';

const SOON = '#появится после бэкенда';

/** Что будет в профиле, когда появится сервер: пока — честные заглушки */
const STATS = ['Конспектов', 'Тестов пройдено', 'Сдач в очереди'];

/**
 * Набросок профиля студента: крупная аватарка с GitHub, контакты и места под то, что появится после бэкенда
 * (о себе, активность). Открыт — `?u=логин` в адресе: ссылкой можно поделиться, «Назад» закрывает.
 */
export function StudentProfile({ student, onClose }: { student: Student | undefined; onClose: () => void }) {
  // Пока окно закрывается, студент уже сброшен — показываем прошлого, иначе закрытию нечего показать
  const last = useRef(student);
  if (student) last.current = student;
  const shown = student ?? last.current;

  return (
    <Modal open={Boolean(student)} onClose={onClose} title={shown?.name ?? ''} description={shown?.role} size="sm">
      {shown && <ProfileBody student={shown} />}
    </Modal>
  );
}

function ProfileBody({ student }: { student: Student }) {
  const github = `https://github.com/${encodeURIComponent(student.github)}`;
  return (
    <div className={styles.profile}>
      <img className={styles.avatar} src={`${github}.png?size=160`} alt="" />
      <span className={styles.fact}>{student.fact}</span>

      <div className={styles.links}>
        <a className={styles.link} href={github} target="_blank" rel="noopener noreferrer">
          <GithubMark size={16} />@{student.github}
        </a>
        {student.telegram && (
          <a className={styles.link} href={`https://t.me/${encodeURIComponent(student.telegram)}`} target="_blank" rel="noopener noreferrer">
            <Send size={16} strokeWidth={1.75} aria-hidden />@{student.telegram}
          </a>
        )}
        <a
          className={styles.link}
          href={`${REPO_URL}/commits?author=${encodeURIComponent(student.github)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Коммиты <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </a>
      </div>

      <section className={styles.section}>
        <h3 className={styles.heading}>О себе</h3>
        <p className={styles.soon}>{SOON}</p>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Активность</h3>
        <dl className={styles.stats}>
          {STATS.map((label) => (
            <div key={label} className={styles.stat}>
              <dt>{label}</dt>
              <dd>—</dd>
            </div>
          ))}
        </dl>
        <p className={styles.soon}>{SOON}</p>
      </section>
    </div>
  );
}
