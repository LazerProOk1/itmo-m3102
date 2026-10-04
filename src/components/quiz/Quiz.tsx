import { motion } from 'framer-motion';
import { ArrowRight, Check, Eye, EyeOff, Flame, ListChecks, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { pluralize } from '../../lib/pluralize';
import { Markdown } from '../markdown/Markdown';
import { Button } from '../ui/Button';
import { Swap } from '../ui/Swap';
import { burst, rain } from './confetti';
import { toISODate } from '../../lib/dates';
import { useQuizStore } from '../../features/quizzes/quizStore';
import { isQuizPage, matchesAnswer, parseQuiz, type QuizData, type QuizQuestion } from './parseQuiz';
import styles from './Quiz.module.css';

const OK_MESSAGES = ['Верно!', 'Отлично!', 'В точку!', 'Так держать!'];
const BAD_MESSAGES = ['Неверно', 'Не совсем', 'Мимо'];
const pick = (items: string[]) => items[Math.floor(Math.random() * items.length)]!;
const RING = 2 * Math.PI * 52;

/** Блок ```quiz в конспекте или целый файл-тест (mode: quiz) — формат сайта группы, см. parseQuiz.ts */
export function Quiz({ source, quizKey }: { source: string; /** Ключ для результатов и повторения ошибок (quizStore) */ quizKey?: string }) {
  const { recordAnswer, recordResult } = useQuizStore();
  const parsed = useMemo(() => {
    try {
      return { data: parseQuiz(source) };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [source]);

  if ('error' in parsed) return <div className={styles.error}>Ошибка в тесте — {parsed.error}</div>;
  return (
    <QuizRunner
      data={parsed.data}
      full={isQuizPage(source)}
      onAnswer={quizKey ? (index, ok) => recordAnswer(quizKey, index, ok, toISODate(new Date())) : undefined}
      onFinish={quizKey ? (correct, total) => recordResult(quizKey, correct, total) : undefined}
    />
  );
}

type Phase = 'intro' | 'question' | 'result';

/** Что ответил человек — для разбора после теста */
interface Given {
  ok: boolean;
  selected: number[];
  text: string;
}

interface QuizRunnerProps {
  data: QuizData;
  full: boolean;
  /** Ответ на вопрос с номером index в data.questions */
  onAnswer?: (index: number, ok: boolean) => void;
  /** Пройден весь тест (не «повтор ошибок») */
  onFinish?: (correct: number, total: number) => void;
}

/** Прохождение готового набора вопросов — его же используют повторение и тест перед контрольной */
export function QuizRunner({ data, full, onAnswer, onFinish }: QuizRunnerProps) {
  const all = data.questions.map((_, index) => index);
  const [phase, setPhase] = useState<Phase>(full ? 'intro' : 'question');
  const [order, setOrder] = useState(all);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Given>>({});
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
    setOrder(onlyWrong ? order.filter((index) => !answers[index]?.ok) : all);
    setRetry(onlyWrong);
    setPos(0);
    setAnswers({});
    setStreak(0);
    setBest(0);
    setRound((value) => value + 1);
    setPhase('question');
    keepInView();
  }

  function answered(given: Given, anchor: DOMRect | undefined) {
    const { ok } = given;
    setAnswers((value) => ({ ...value, [order[pos]!]: given }));
    onAnswer?.(order[pos]!, ok);
    const nextStreak = ok ? streak + 1 : 0;
    setStreak(nextStreak);
    setBest((value) => Math.max(value, nextStreak));
    if (ok && anchor) {
      burst(Math.min(anchor.left + 40, innerWidth - 20), anchor.top + anchor.height / 2, 26 + Math.min(nextStreak, 6) * 8);
      if (nextStreak >= 3) burst(innerWidth - 60, innerHeight * 0.6, 40);
    }
  }

  function next() {
    if (pos + 1 >= total) {
      setPhase('result');
      if (!retry) onFinish?.(order.filter((index) => answers[index]?.ok).length, total);
    } else setPos(pos + 1);
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
        {phase === 'result' && (
          <Result results={order.map((index) => Boolean(answers[index]?.ok))} best={best} onRestart={restart}>
            <Review data={data} order={order} answers={answers} />
          </Result>
        )}
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
  onAnswer: (given: Given, anchor: DOMRect | undefined) => void;
  onNext: () => void;
}

function QuestionCard({ question, last, full, onAnswer, onNext }: QuestionCardProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<{ ok: boolean; message: string } | null>(null);
  // Правильный ответ после ошибки — только по кнопке: сначала можно подумать самому
  const [revealed, setRevealed] = useState(false);
  const optionRefs = useRef<(HTMLElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const single = question.type === 'single';
  const locked = verdict !== null;
  const showAnswer = verdict !== null && (verdict.ok || revealed);
  const canCheck = question.type === 'text' ? text.trim() !== '' : selected.length > 0;

  function toggle(index: number) {
    if (locked) return;
    setSelected((value) => (single ? [index] : value.includes(index) ? value.filter((item) => item !== index) : [...value, index]));
  }

  function check() {
    if (locked || !canCheck) return;
    const ok = isRight(question, selected, text);
    setVerdict({ ok, message: pick(ok ? OK_MESSAGES : BAD_MESSAGES) });
    const anchor =
      question.type === 'text'
        ? inputRef.current
        : optionRefs.current[question.options.findIndex((option, index) => option.ok && selected.includes(index))];
    onAnswer({ ok, selected, text }, anchor?.getBoundingClientRect());
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
        <AnswerOptions question={question} selected={selected} locked={locked} showAnswer={showAnswer} onToggle={toggle} refs={optionRefs.current} />
      )}

      {verdict && (
        <motion.div
          className={cn(styles.feedback, verdict.ok ? styles.ok : styles.bad)}
          aria-live="polite"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className={styles.feedbackTitle}>
            {verdict.ok ? <Check size={16} strokeWidth={2.5} aria-hidden /> : <X size={16} strokeWidth={2.5} aria-hidden />} {verdict.message}
          </p>
          {/* Подсказка автора на ошибку — сразу (она наводит, а не отвечает); ответ и объяснение — по кнопке */}
          {!verdict.ok && question.wrong && <Markdown content={question.wrong} className={styles.why} />}
          {showAnswer && <AnswerExplanation question={question} ok={verdict.ok} />}
        </motion.div>
      )}

      <div className={styles.actions}>
        {locked && !showAnswer && (
          <Button variant="ghost" icon={Eye} onClick={() => setRevealed(true)}>
            Показать правильный ответ
          </Button>
        )}
        {locked ? (
          <Button ref={nextRef} variant="primary" onClick={onNext}>
            {last ? (
              'Результат'
            ) : (
              <>
                Далее <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </>
            )}
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

function isRight(question: QuizQuestion, selected: number[], text: string): boolean {
  if (question.type === 'text') return matchesAnswer(question.answers, text);
  const want = question.options.flatMap((option, index) => (option.ok ? [index] : []));
  return selected.length === want.length && want.every((index) => selected.includes(index));
}

interface AnswerOptionsProps {
  question: QuizQuestion;
  selected: number[];
  locked: boolean;
  /** Подсветить правильные варианты (ответ верный или открыт по кнопке) */
  showAnswer: boolean;
  /** Нет — только просмотр (разбор после теста) */
  onToggle?: (index: number) => void;
  refs?: (HTMLElement | null)[];
}

/**
 * Варианты ответа — в вопросе и в разборе. Пока ответ не открыт, после ошибки не видно, какие варианты верные:
 * в «одном ответе» выбранный — красный (он точно неверен), в «нескольких» выбранные — просто выбранные
 * (зелёный на части из них подсказал бы ответ).
 */
function AnswerOptions({ question, selected, locked, showAnswer, onToggle, refs }: AnswerOptionsProps) {
  if (question.type === 'text') return null;
  const single = question.type === 'single';
  const Element = onToggle ? 'button' : 'div';
  return (
    <div className={styles.options} role={single ? 'radiogroup' : 'group'}>
      {question.options.map((option, index) => {
        const isSelected = selected.includes(index);
        const state = !locked
          ? isSelected && styles.selected
          : showAnswer
            ? option.ok && isSelected
              ? styles.correct
              : isSelected
                ? styles.wrong
                : option.ok
                  ? styles.missed
                  : styles.dim
            : isSelected
              ? single
                ? styles.wrong
                : styles.selected
              : styles.dim;
        // Иконки, а не символы ✓/✕: шрифтовые глифы на телефонах рисуются как эмодзи и прыгают по высоте
        const Mark = state === styles.wrong ? X : state === styles.dim || !state ? null : state === styles.selected && single ? null : Check;
        return (
          <Element
            key={index}
            ref={(element: HTMLElement | null) => {
              if (refs) refs[index] = element;
            }}
            {...(onToggle ? { type: 'button' as const, onClick: () => onToggle(index) } : {})}
            role={single ? 'radio' : 'checkbox'}
            aria-checked={isSelected}
            aria-disabled={onToggle ? undefined : true}
            className={cn(styles.option, !onToggle && styles.static, state)}
          >
            <span className={cn(styles.mark, single && styles.round)}>{Mark && <Mark size={13} strokeWidth={3} aria-hidden />}</span>
            <span className={styles.optionBody}>
              <Markdown content={option.text} className={styles.inline} />
              {showAnswer && option.note && (isSelected || option.ok) && <Markdown content={option.note} className={styles.note} />}
            </span>
          </Element>
        );
      })}
    </div>
  );
}

/** Правильный ответ (если ошибся) и объяснение автора */
function AnswerExplanation({ question, ok }: { question: QuizQuestion; ok: boolean }) {
  const why = ok ? question.correct || question.explain : question.explain;
  return (
    <>
      {!ok && (
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
    </>
  );
}

/** Разбор после теста: все вопросы этого прохода с вашими ответами; правильные — по кнопке */
function Review({ data, order, answers }: { data: QuizData; order: number[]; answers: Record<number, Given> }) {
  const [revealAll, setRevealAll] = useState(false);
  const anyWrong = order.some((index) => !answers[index]?.ok);
  return (
    <section className={styles.review} aria-label="Ваши ответы">
      <div className={styles.reviewHead}>
        <h4 className={styles.reviewTitle}>Ваши ответы</h4>
        {anyWrong && (
          <Button variant="ghost" size="sm" icon={revealAll ? EyeOff : Eye} onClick={() => setRevealAll((value) => !value)}>
            {revealAll ? 'Скрыть правильные' : 'Показать все правильные'}
          </Button>
        )}
      </div>
      <ol className={styles.reviewList}>
        {order.map((index, number) => (
          <ReviewItem key={index} number={number + 1} question={data.questions[index]!} given={answers[index]} revealAll={revealAll} />
        ))}
      </ol>
    </section>
  );
}

function ReviewItem({ number, question, given, revealAll }: { number: number; question: QuizQuestion; given?: Given; revealAll: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const ok = Boolean(given?.ok);
  const showAnswer = ok || revealed || revealAll;
  return (
    <li className={cn(styles.reviewItem, ok ? styles.reviewOk : styles.reviewBad)}>
      <div className={styles.reviewQuestion}>
        <span className={styles.reviewStatus} aria-label={ok ? 'Верно' : 'Неверно'}>
          {ok ? <Check size={14} strokeWidth={2.5} aria-hidden /> : <X size={14} strokeWidth={2.5} aria-hidden />}
        </span>
        <span className={styles.reviewNumber}>{number}.</span>
        <Markdown content={question.question} className={styles.question} />
      </div>
      {question.type === 'text' ? (
        <p className={styles.yourAnswer}>
          Ваш ответ: <strong className={ok ? styles.yourOk : styles.yourBad}>{given?.text || '—'}</strong>
        </p>
      ) : (
        <AnswerOptions question={question} selected={given?.selected ?? []} locked showAnswer={showAnswer} />
      )}
      {showAnswer ? (
        <div className={styles.reviewExplain}>
          <AnswerExplanation question={question} ok={ok} />
        </div>
      ) : (
        <Button variant="ghost" size="sm" icon={Eye} onClick={() => setRevealed(true)}>
          Показать правильный ответ
        </Button>
      )}
    </li>
  );
}

function Result({
  results,
  best,
  onRestart,
  children,
}: {
  results: boolean[];
  best: number;
  onRestart: (onlyWrong: boolean) => void;
  /** Разбор ответов — открывается кнопкой «Мои ответы» */
  children: ReactNode;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
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
        <Button variant="ghost" icon={ListChecks} aria-expanded={reviewOpen} onClick={() => setReviewOpen((value) => !value)}>
          {reviewOpen ? 'Скрыть ответы' : 'Мои ответы'}
        </Button>
      </div>
      {reviewOpen && children}
    </div>
  );
}
