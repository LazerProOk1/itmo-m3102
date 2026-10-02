import type { CSSProperties } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Section } from '../../components/ui/Section';
import { deadlineInfo } from '../deadlines/deadlineInfo';
import { LinkCards } from '../group/LinksPage';
import { classTypeColorVar, CLASS_TYPE_LABELS } from '../schedule/labels';
import type { ClassOccurrence } from '../schedule/occurrences';
import { NextClassBlock } from '../today/NextClassBlock';
import type { ClassType } from '../../types/models';
import { Demo } from './Demo';
import styles from './DesignSystemPage.module.css';

const occurrence = (subjectId: string, type: ClassType, startTime: string, endTime: string, room: string): ClassOccurrence => ({
  key: `demo-${subjectId}`,
  date: '2026-10-01',
  status: 'regular',
  details: { subjectId, type, startTime, endTime, room, teacher: '' },
});

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-01T12:00:00+03:00');
const DEADLINES = [-1, 5, 40, 24 * 9].map((hours) => deadlineInfo(new Date(NOW + hours * HOUR).toISOString(), NOW));

const LINKS = [
  {
    title: 'Yonote по алгоритмам',
    description: 'Общие материалы курса',
    url: 'https://dm-aisd.yonote.ru',
    group: 'Демо',
    subject: 'Алгоритмы и структуры данных',
    kind: '',
  },
  {
    title: 'Форма сдачи лабы',
    description: 'Ссылка из data/links.json',
    url: 'https://forms.gle/demo',
    group: 'Демо',
    subject: 'Основы программирования',
    kind: '',
  },
];

/** Элементы, из которых собраны страницы группы: главная, расписание, дедлайны, ссылки. */
export function SiteDemo() {
  return (
    <Section title="Элементы сайта группы">
      <Demo label="Следующая пара · главная; таблетка слева — цвет типа пары">
        <div className={styles.blocks}>
          <NextClassBlock status={{ kind: 'now', occurrence: occurrence('linal', 'practice', '11:30', '13:00', '2430'), minutesLeft: 42 }} />
          <NextClassBlock status={{ kind: 'next', occurrence: occurrence('aisd', 'lecture', '13:30', '15:00', '1404'), minutesUntil: 25 }} />
          <NextClassBlock
            status={{ kind: 'finished', next: { occurrence: occurrence('op', 'lab', '09:50', '11:20', '2238'), dayLabel: 'завтра' } }}
          />
        </div>
      </Demo>
      <Demo label="Типы пар · полоска-таблетка у карточек расписания, календаря и главной">
        <div className={styles.pills}>
          {(Object.keys(CLASS_TYPE_LABELS) as ClassType[]).map((type) => (
            <span key={type} className={styles.pill} style={{ '--type-color': classTypeColorVar(type) } as CSSProperties}>
              {CLASS_TYPE_LABELS[type]}
            </span>
          ))}
        </div>
      </Demo>
      <Demo label="Срок дедлайна · по календарным дням: просрочен, сегодня, скоро, есть время">
        {DEADLINES.map((badge) => (
          <Badge key={badge.label} tone={badge.tone}>
            {badge.label}
          </Badge>
        ))}
      </Demo>
      <Demo label="Карточки ссылок · «Полезные ссылки» и вкладка «Ссылки» предмета">
        <div className={styles.blocks}>
          <LinkCards links={LINKS} />
        </div>
      </Demo>
    </Section>
  );
}
