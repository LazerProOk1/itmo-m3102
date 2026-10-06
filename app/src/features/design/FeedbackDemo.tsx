import { Inbox, Plus, SquareCheck } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Section } from '../../components/ui/Section';
import { Demo } from './Demo';
import styles from './DesignSystemPage.module.css';

/** Бейджи и пустые состояния. */
export function FeedbackDemo() {
  return (
    <>
      <Section title="Бейджи">
        <Demo label="Оттенки">
          <Badge>Нейтральный</Badge>
          <Badge tone="accent">через 42 мин</Badge>
          <Badge tone="success">Готово</Badge>
          <Badge tone="warning">Высокий</Badge>
          <Badge tone="danger">Критичный</Badge>
        </Demo>
        <Demo label="С точкой">
          <Badge tone="accent" dot>
            Пары
          </Badge>
          <Badge tone="warning" dot>
            Задачи
          </Badge>
          <Badge tone="danger" dot>
            Дедлайны
          </Badge>
        </Demo>
      </Section>

      <Section title="Пустые состояния">
        <Demo label="Страница">
          <div className={styles.wide}>
            <EmptyState
              icon={Inbox}
              title="Пока нет материалов"
              description="Добавьте слайды лекций, конспекты или ссылки этого предмета."
              action={
                <Button size="sm" icon={Plus}>
                  Добавить материал
                </Button>
              }
            />
          </div>
        </Demo>
        <Demo label="Внутри раздела">
          <div className={styles.wide}>
            <EmptyState compact icon={SquareCheck} title="На сегодня задач нет" description="Здесь появятся задачи со сроком сегодня." />
          </div>
        </Demo>
      </Section>
    </>
  );
}
