import { useEffect, useState } from 'react';
import { Quiz } from '../../components/quiz/Quiz';
import { siteQuizFor } from './siteQuizzes';
import styles from './SiteQuiz.module.css';

/** «Проверь себя» под конспектом M3102 — тест с этого сайта (см. siteQuizzes.ts), если он есть */
export function SiteQuiz({ sourceRef }: { sourceRef: string | undefined }) {
  const load = siteQuizFor(sourceRef);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSource(null);
    void load?.().then((text) => alive && setSource(text));
    return () => {
      alive = false;
    };
  }, [load]);

  if (!source) return null;
  return (
    <section className={styles.section} aria-labelledby="site-quiz">
      <header className={styles.header}>
        <h2 id="site-quiz" className={styles.title}>
          Проверь себя
        </h2>
        <span className={styles.origin}>Тест сделан на этом сайте</span>
      </header>
      <p className={styles.note}>Его нет в репозитории группы: вопросы составлены по этому конспекту и хранятся только здесь.</p>
      <Quiz source={source} />
    </section>
  );
}
