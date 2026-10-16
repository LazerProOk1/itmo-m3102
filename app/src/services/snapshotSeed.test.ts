// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { useGroupStore } from '../features/group/groupStore';
import { useHomeworkStore } from '../features/homework/homeworkStore';
import { applySnapshot } from './snapshotSeed';

describe('снимок данных группы', () => {
  it('кладёт дедлайны, ссылки и ДЗ; сломанный файл (расписание) пропускает, остальные применяет', () => {
    const applied = applySnapshot({
      deadlines: [{ id: 'lab-1', name: 'АИСД - Лаба', deadline: '2026-10-23T23:59:00+03:00', note: 'Сдача' }],
      homework: { items: [{ id: 'hw-1', subject: 'Линейная алгебра', text: 'Задачи', due: '2026-10-30' }] },
      links: { items: [{ title: 'Конспекты', url: 'https://github.com/RedstoneLord/itmo-m3102', group: 'Репозиторий' }] },
      schedule: { сломано: true },
    });
    expect(applied).toBe(3);
    expect(useGroupStore.getState().deadlines.map((item) => item.id)).toEqual(['lab-1']);
    expect(useGroupStore.getState().links).toHaveLength(1);
    expect(useHomeworkStore.getState().base.map((item: { id: string }) => item.id)).toEqual(['hw-1']);
  });

  it('пустой снимок ничего не ломает', () => {
    expect(applySnapshot({ deadlines: null, homework: null, links: null, schedule: null })).toBe(1);
  });
});
