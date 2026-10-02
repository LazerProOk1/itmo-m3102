import { Mail, Send } from 'lucide-react';
import { List, ListItem } from '../../components/ui/List';
import { Section } from '../../components/ui/Section';
import { CLASS_TYPE_LABELS } from '../schedule/labels';
import type { SubjectContact } from '../../types/models';
import { telegramUrl } from './contacts';
import styles from './SubjectContactsSection.module.css';

interface SubjectContactsSectionProps {
  contacts: SubjectContact[];
  telegramChatUrl?: string;
}

/** Компактный блок в шапке предмета: контакты по ролям и ссылка на общий чат. */
export function SubjectContactsSection({ contacts, telegramChatUrl }: SubjectContactsSectionProps) {
  return (
    <Section title="Контакты" className={styles.section}>
      {contacts.length === 0 ? (
        <p className={styles.empty}>Контакты не добавлены</p>
      ) : (
        <List>
          {contacts.map((contact, index) => (
            <ListItem
              key={index}
              leading={<span className={styles.role}>{CLASS_TYPE_LABELS[contact.role]}</span>}
              title={contact.teacherName}
              trailing={
                <>
                  {contact.email && (
                    <a className={styles.contactLink} href={`mailto:${contact.email}`} aria-label={`Написать на почту: ${contact.teacherName}`}>
                      <Mail size={13} strokeWidth={1.75} aria-hidden />
                    </a>
                  )}
                  {contact.telegram && (
                    <a
                      className={styles.contactLink}
                      href={telegramUrl(contact.telegram)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Написать в Telegram: ${contact.teacherName}`}
                    >
                      <Send size={13} strokeWidth={1.75} aria-hidden />
                      Telegram
                    </a>
                  )}
                </>
              }
            />
          ))}
        </List>
      )}

      {telegramChatUrl && (
        <p className={styles.chatRow}>
          Чат группы:{' '}
          <a href={telegramUrl(telegramChatUrl)} target="_blank" rel="noopener noreferrer" className={styles.chatLink}>
            Открыть Telegram →
          </a>
        </p>
      )}
    </Section>
  );
}
