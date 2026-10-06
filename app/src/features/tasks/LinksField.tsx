import { Link2, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import { checkUrl } from '../../lib/url';
import styles from './LinksField.module.css';

interface LinksFieldProps {
  links: string[];
  onChange: (links: string[]) => void;
}

/**
 * Список ссылок задачи. Добавление — по кнопке или клавише Enter в поле,
 * удаление — по одной кнопкой рядом со ссылкой.
 */
export function LinksField({ links, onChange }: LinksFieldProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  function addLink() {
    const value = draft.trim();
    if (!value) return;

    const validationError = checkUrl(value);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!links.includes(value)) onChange([...links, value]);
    setDraft('');
    setError('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault(); // не отправлять всю форму задачи
    addLink();
  }

  function removeLink(url: string) {
    onChange(links.filter((link) => link !== url));
  }

  return (
    <div>
      {links.length > 0 && (
        <ul className={styles.list}>
          {links.map((url) => (
            <li key={url} className={styles.row}>
              <Link2 size={13} strokeWidth={1.75} className={styles.icon} aria-hidden />
              <span className={styles.url}>{url}</span>
              <IconButton icon={X} label={`Удалить ссылку ${url}`} size="sm" onClick={() => removeLink(url)} />
            </li>
          ))}
        </ul>
      )}

      <div className={styles.addRow}>
        <Input
          value={draft}
          placeholder="https://"
          invalid={Boolean(error)}
          aria-label="Адрес ссылки"
          onChange={(event) => {
            setDraft(event.target.value);
            setError('');
          }}
          onKeyDown={handleKeyDown}
        />
        <Button type="button" size="sm" onClick={addLink}>
          Добавить
        </Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
