import { useSearchParams } from 'react-router';
import { PageHeader } from '../../components/ui/PageHeader';
import { M3102_STUDENTS } from '../../data/m3102';
import { REPO_URL } from '../../services/github';
import { StudentProfile } from './StudentProfile';
import styles from './StudentsPage.module.css';

/** Студенты группы М3102: фото с GitHub, контакты, факт о себе и коммиты; карточка открывает профиль. */
export function StudentsPage() {
  const [params, setParams] = useSearchParams();
  const login = params.get('u');
  const profile = login ? M3102_STUDENTS.find((student) => student.github === login) : undefined;

  return (
    <>
      <PageHeader
        title="Студенты группы М3102"
        subtitle="Нажмите на карточку — откроется профиль. «Коммиты» — история правок студента в репозитории материалов группы."
      />
      <div className={`${styles.grid} stagger`}>
        {M3102_STUDENTS.map((student) => {
          const github = `https://github.com/${encodeURIComponent(student.github)}`;
          return (
            <article key={student.github} className={styles.card} data-spot>
              <img
                className={styles.photo}
                src={`${github}.png?size=160`}
                alt=""
                loading="lazy"
                onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
              />
              <div className={styles.info}>
                <h3 className={styles.name}>
                  <button type="button" className={styles.open} data-row-action onClick={() => setParams({ u: student.github })}>
                    {student.name}
                  </button>
                </h3>
                <div className={styles.links}>
                  <a href={github} target="_blank" rel="noopener noreferrer">
                    GitHub · @{student.github}
                  </a>
                  {student.telegram && (
                    <a href={`https://t.me/${encodeURIComponent(student.telegram)}`} target="_blank" rel="noopener noreferrer">
                      Telegram · @{student.telegram}
                    </a>
                  )}
                </div>
                <div className={styles.pills}>
                  <span className={styles.pill}>{student.fact}</span>
                  {student.role && <span className={styles.role}>{student.role}</span>}
                  <a
                    className={styles.commits}
                    href={`${REPO_URL}/commits?author=${encodeURIComponent(student.github)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Коммиты ↗
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <StudentProfile student={profile} onClose={() => setParams({})} />
    </>
  );
}
