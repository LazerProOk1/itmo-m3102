import { describe, expect, it } from 'vitest';
import { nextReview } from './quizStore';

describe('повторение ошибок', () => {
  it('ошибка — завтра, верно — 3, 7, 14 дней, потом выучено; верный ответ вне повторения ничего не добавляет', () => {
    const wrong = nextReview(undefined, 'q', 2, false, '2026-10-03')!;
    expect(wrong).toEqual({ quiz: 'q', index: 2, step: 0, due: '2026-10-04' });
    const s1 = nextReview(wrong, 'q', 2, true, '2026-10-04')!;
    expect(s1).toMatchObject({ step: 1, due: '2026-10-07' });
    const s2 = nextReview(s1, 'q', 2, true, '2026-10-07')!;
    const s3 = nextReview(s2, 'q', 2, true, '2026-10-14')!;
    expect(s3).toMatchObject({ step: 3, due: '2026-10-28' });
    expect(nextReview(s3, 'q', 2, true, '2026-10-28')).toBeNull();
    expect(nextReview(s2, 'q', 2, false, '2026-10-14')).toMatchObject({ step: 0, due: '2026-10-15' });
    expect(nextReview(undefined, 'q', 2, true, '2026-10-03')).toBeNull();
  });
});
