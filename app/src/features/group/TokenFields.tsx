import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { forgetToken, getToken, GROUP_REPO, PAT_URL } from '../../services/github';
import styles from './group.module.css';

export interface TokenValue {
  token: string;
  remember: boolean;
}

interface TokenFieldsProps {
  value: TokenValue;
  onChange: (value: TokenValue) => void;
}

/** Поля fine-grained PAT для записи в репозиторий группы — как в диалогах публикации сайта M3102 */
export function TokenFields({ value, onChange }: TokenFieldsProps) {
  const [hasToken, setHasToken] = useState(() => Boolean(getToken()));

  return (
    <>
      <Field
        label="Fine-grained PAT"
        htmlFor="github-token"
        hint={`Доступ только к ${GROUP_REPO.owner}/${GROUP_REPO.repo}, право Contents: Read and write. Не сохраняйте токен на чужом компьютере.`}
      >
        <Input
          id="github-token"
          type="password"
          autoComplete="off"
          value={value.token}
          placeholder={hasToken ? 'Токен уже сохранён — можно оставить пустым' : 'github_pat_…'}
          onChange={(event) => onChange({ ...value, token: event.target.value })}
        />
      </Field>
      <div className={styles.tokenRow}>
        <Checkbox
          label="Запомнить на этом устройстве"
          checked={value.remember}
          onChange={(event) => onChange({ ...value, remember: event.target.checked })}
        />
        <a href={PAT_URL} target="_blank" rel="noopener noreferrer">
          Создать токен ↗
        </a>
        {hasToken && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              forgetToken();
              setHasToken(false);
            }}
          >
            Забыть токен
          </Button>
        )}
      </div>
    </>
  );
}
