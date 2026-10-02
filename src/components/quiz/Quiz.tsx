import { motion } from 'framer-motion';
import { Flame, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { pluralize } from '../../lib/pluralize';
import { Markdown } from '../markdown/Markdown';
import { Button } from '../ui/Button';
import { Swap } from '../ui/Swap';
import { burst, rain } from './confetti';
import { isQuizPage, matchesAnswer, parseQuiz, type QuizData, type QuizQuestion } from './parseQuiz';
import styles from './Quiz.module.css';

const OK_MESSAGES = ['Верно!', 'Отлично!', 'В точку!', 'Так держать!'];
const BAD_MESSAGES = ['Неверно', 'Не совсем', 'Мимо'];
const pick = (items: string[]) => items[Math.floor(Math.random() * items.length)]!;
const RING = 2 * Math.PI * 52;

/** Блок ```quiz в конспекте или целый файл-тест (mode: quiz) — формат сайта группы, см. parseQuiz.ts */
export function Quiz({ source }: { source: string }) {
  const parsed = useMemo(() => {
    try {
      return { data: parseQuiz(source) };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [source]);

  if ('error' in parsed) return <div className={styles.error}>Ошибка в тесте — {parsed.error}</div>;
  return <QuizRunner data={parsed.data} full={isQuizPage(source)} />;
}

type Phase = 'intro' | 'question' | 'result';

function QuizRunner({ data, full }: { data: QuizData; full: boolean }) {
  const all = data.questions.map((_, index) => index);
  const [phase, setPhase] = useState<Phase>(full ? 'intro' : 'question');
  const [order, setOrder] = useState(all);
  const [pos, setPos] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [retry, setRetry] = useState(false);
  const [round, setRound] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const total = order.length;
  const progress = phase === 'result' ? 100 : phase === 'intro' ? 0 : (pos / total) * 100;

  function keepInView() {
    const root = rootRef.current;
    if (!root) return;
    const top = root.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.6) root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function restart(onlyWrong: boolean) {
    setOrder(onlyWrong ? order.filter((index) => !results[index]) : all);
    setRetry(onlyWrong);
    setPos(0);
    setResults({});
    setStreak(0);
    setBest(0);
    setRound((value) => value + 1);
    setPhase('question');
    keepInView();
  }

  function answered(ok: boolean, anchor: DOMRect | undefined) {
    setResults((value) => ({ ...value, [order[pos]!]: ok }));
    const nextStreak = ok ? streak + 1 : 0;
    setStreak(nextStreak);
    setBest((value) => Math.max(value, nextStreak));
    if (ok && anchor) {
      burst(Math.min(anchor.left + 40, innerWidth - 20), anchor.top + anchor.height / 2, 26 + Math.min(nextStreak, 6) * 8);
      if (nextStreak >= 3) burst(innerWidth - 60, innerHeight * 0.6, 40);
    }
  }

  function next() {
    if (pos + 1 >= total) setPhase('result');
    else setPos(pos + 1);
    keepInView();
  }

  return (
    <div ref={rootRef} className={cn(styles.quiz, full && styles.full)} data-spot>
      <div className={styles.head}>
        <div className={styles.title}>
          <ListChecks size={18} strokeWidth={1.75} aria-hidden />
          {data.title || 'Проверь себя'}
        </div>
        <div className={styles.meta}>
          {phase === 'question' && streak >= 2 && (
            <motion.span key={streak} className={styles.streak} initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
              <Flame size={14} strokeWidth={2} aria-hidden /> {streak}
            </motion.span>
          )}
          {phase !== 'intro' && (
            <span>
              {retry && phase === 'question' && 'Повтор ошибок · '}
              {phase === 'result' ? total : pos + 1} / {total}
            </span>
          )}
        </div>
      </div>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <Swap id={`${phase}-${round}-${pos}`} direction={1}>
        {phase === 'intro' && <Intro data={data} onStart={() => setPhase('question')} />}
        {phase === 'question' && (
          <QuestionCard
            key={`${round}-${pos}`}
            question={data.questions[order[pos]!]!}
            last={pos + 1 >= total}
            full={full}
            onAnswer={answered}
            onNext={next}
          />
        )}
        {phase === 'result' && <Result results={order.map((index) => Boolean(results[index]))} best={best} onRestart={restart} />}
      </Swap>
    </div>
  );
}

function Intro({ data, onStart }: { data: QuizData; onStart: () => void }) {
  const count = (type: QuizQuestion['type']) => data.questions.filter((question) => question.type === type).length;
  const chips = [
    count('single') && `${count('single')} с одним ответом`,
    count('multi') && `${count('multi')} с несколькими ответами`,
    count('text') && `${count('text')} с вводом ответа`,
  ].filter(Boolean);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) onStart();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className={styles.intro}>
      {data.description && <Markdown content={data.description} className={styles.description} />}
      <p className={styles.introCount}>{pluralize(data.questions.length, ['вопрос', 'вопроса', 'вопросов'])}</p>
      <div className={styles.chips}>
        {chips.map((chip) => (
          <span key={String(chip)}>{chip}</span>
        ))}
      </div>
      <p className={styles.hint}>
        Клавиши: <kbd>1</kbd>–<kbd>9</kbd> — выбрать вариант, <kbd>Enter</kbd> — проверить / далее
      </p>
      <Button variant="primary" onClick={onStart} autoFocus>
        Начать
      </Button>
    </div>
  );
}

interface QuestionCardProps {
  question: QuizQuestion;
  last: boolean;
  full: boolean;
  onAnswer: (ok: boolean, anchor: DOMRect | undefined) => void;
  onNext: () => void;
}

function QuestionCard({ question, last, full, onAnswer, onNext }: QuestionCardProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<{ ok: boolean; message: string } | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const single = question.type === 'single';
  const locked = verdict !== null;
  const canCheck = question.type === 'text' ? text.trim() !== '' : selected.length > 0;

  function toggle(index: number) {
    if (locked) return;
    setSelected((value) => (single ? [index] : value.includes(index) ? value.filter((item) => item !== index) : [...value, index]));
  }

  function check() {
    if (locked || !canCheck) return;
    let ok: boolean;
    if (question.type === 'text') {
      ok = matchesAnswer(question.answers, text);
    } else {
      const want = question.options.flatMap((option, index) => (option.ok ? [index] : []));
      ok = selected.length === want.length && want.every((index) => selected.includes(index));
    }
    setVerdict({ ok, message: pick(ok ? OK_MESSAGES : BAD_MESSAGES) });
    const anchor =
      question.type === 'text'
        ? inputRef.current
        : optionRefs.current[question.options.findIndex((option, index) => option.ok && selected.includes(index))];
    onAnswer(ok, anchor?.getBoundingClientRect());
  }

  useEffect(() => {
    if (locked) nextRef.current?.focus({ preventScroll: true });
  }, [locked]);

  // Тест на всю страницу: 1–9 выбирают вариант, Enter — проверить / далее
  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (/^[1-9]$/.test(event.key) && !locked && question.type !== 'text') {
        const index = Number(event.key) - 1;
        if (index < question.options.length) {
          toggle(index);
          event.preventDefault();
        }
      } else if (event.key === 'Enter' && target?.tagName !== 'BUTTON') {
        event.preventDefault();
        if (locked) onNext();
        else check();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const why = verdict ? (verdict.ok ? question.correct || question.explain : question.wrong || question.explain) : '';

  return (
    <motion.div
      className={styles.card}
      animate={verdict ? (verdict.ok ? { scale: [1, 1.015, 1] } : { x: [0, -6, 6, -4, 0] }) : undefined}
      transition={{ duration: 0.4 }}
    >
      <p className={styles.kind}>{question.type === 'text' ? 'Введите ответ' : single ? 'Выберите один ответ' : 'Выберите все верные ответы'}</p>
      <Markdown content={question.question} className={styles.question} />

      {question.type === 'text' ? (
        <input
          ref={inputRef}
          className={cn(styles.input, verdict && (verdict.ok ? styles.correct : styles.wrong))}
          value={text}
          readOnly={locked}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (locked) onNext();
            else check();
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Ваш ответ…"
          aria-label="Ваш ответ"
        />
      ) : (
        <div className={styles.options} role={single ? 'radiogroup' : 'group'}>
          {question.options.map((option, index) => {
            const isSelected = selected.includes(index);
            const state = !locked
              ? isSelected && styles.selected
              : option.ok && isSelected
                ? styles.correct
                : isSelected
                  ? styles.wrong
                  : option.ok
                    ? styles.missed
                    : styles.dim;
            const mark = !locked ? (isSelected && !single ? '✓' : '') : state === styles.wrong ? '✕' : state === styles.dim ? '' : '✓';
            return (
              <button
                key={index}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role={single ? 'radio' : 'checkbox'}
                aria-checked={isSelected}
                className={cn(styles.option, state)}
                onClick={() => toggle(index)}
              >
                <span className={cn(styles.mark, single && styles.round)}>{mark}</span>
                <span className={styles.optionBody}>
                  <Markdown content={option.text} className={styles.inline} />
                  {locked && option.note && (isSelected || option.ok) && <Markdown content={option.note} className={styles.note} />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {verdict && (
        <motion.div
          className={cn(styles.feedback, verdict.ok ? styles.ok : styles.bad)}
          aria-live="polite"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className={styles.feedbackTitle}>
            {verdict.ok ? '✓' : '✕'} {verdict.message}
          </p>
          {!verdict.ok && (
            <p className={styles.answer}>
              Правильный ответ:{' '}
              {question.type === 'text' ? (
                <strong>
                  {question.answers[0]}
                  {question.answers.length > 1 && <span> (также: {question.answers.slice(1).join(', ')})</span>}
                </strong>
              ) : (
                question.options
                  .filter((option) => option.ok)
                  .map((option, index) => (
                    <strong key={index} className={styles.answerItem}>
                      <Markdown content={option.text} className={styles.inline} />
                    </strong>
                  ))
              )}
            </p>
          )}
          {why && <Markdown content={why} className={styles.why} />}
        </motion.div>
      )}

      <div className={styles.actions}>
        {locked ? (
          <Button ref={nextRef} variant="primary" onClick={onNext}>
            {last ? 'Результат' : 'Далее →'}
          </Button>
        ) : (
          <Button variant="primary" onClick={check} disabled={!canCheck}>
            Проверить
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function Result({ results, best, onRestart }: { results: boolean[]; best: number; onRestart: (onlyWrong: boolean) => void }) {
  const total = results.length;
  const good = results.filter(Boolean).length;
  const wrong = total - good;
  const share = good / total;
  const ringRef = useRef<HTMLDivElement>(null);
  const [title, tone] =
    share === 1
      ? ['Безупречно!', styles.good]
      : share >= 0.8
        ? ['Отличный результат!', styles.good]
        : share >= 0.5
          ? ['Неплохо, но есть что повторить', styles.so]
          : ['Стоит перечитать конспект', styles.poor];

  useEffect(() => {
    if (share < 0.8 || !ringRef.current) return undefined;
    const rect = ringRef.current.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 90);
    rain(share === 1 ? 170 : 70);
    if (share === 1) {
      const timers = [350, 800].map((delay) =>
        setTimeout(() => burst(innerWidth * (0.2 + Math.random() * 0.6), innerHeight * (0.2 + Math.random() * 0.3), 70, true), delay),
      );
      return () => timers.forEach(clearTimeout);
    }
    return undefined;
  }, [share]);

  return (
    <div className={cn(styles.result, tone)}>
      <div ref={ringRef} className={styles.ring}>
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle className={styles.ringBg} cx="60" cy="60" r="52" />
          <motion.circle
            className={styles.ringFg}
            cx="60"
            cy="60"
            r="52"
            strokeDasharray={RING}
            initial={{ strokeDashoffset: RING }}
            animate={{ strokeDashoffset: RING * (1 - share) }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          />
        </svg>
        <span className={styles.ringNumber}>
          {good}/{total}
        </span>
      </div>
      <p className={styles.resultTitle}>{title}</p>
      <p className={styles.resultSub}>
        Верно: {Math.round(share * 100)}%{best >= 2 && ` · лучшая серия: ${best} подряд`}
      </p>
      <div className={styles.actions}>
        {wrong > 0 && (
          <Button variant="primary" onClick={() => onRestart(true)}>
            Повторить ошибки ({wrong})
          </Button>
        )}
        <Button variant={wrong > 0 ? 'secondary' : 'primary'} onClick={() => onRestart(false)}>
          Пройти заново
        </Button>
      </div>
    </div>
  );
}
