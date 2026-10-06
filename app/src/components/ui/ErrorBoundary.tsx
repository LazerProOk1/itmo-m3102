import { TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buttonClass } from './Button';
import { EmptyState } from './EmptyState';
import styles from './ErrorBoundary.module.css';

const RELOADED_KEY = 'm3102:chunk-reload';

/**
 * После деплоя у открытой вкладки старые имена файлов сборки: подгрузка страницы падает с
 * «Failed to fetch dynamically imported module». Лечится перезагрузкой — делаем её сами, один раз.
 */
function isStaleChunk(error: unknown): boolean {
  return error instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(error.message);
}

/** Не чаще раза в 30 с: если после перезагрузки снова ошибка — значит, дело не в старой сборке, показываем сообщение */
function reloadOnce(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_KEY) ?? 0) < 30_000) return false;
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Ошибка в одной странице не роняет весь сайт: вместо белого экрана — сообщение, меню и шапка работают.
 * В AppShell обёртка с key = путь, поэтому переход на другую страницу начинает с чистого листа.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isStaleChunk(error) && reloadOnce()) return;
    console.error(error, info.componentStack);
  }

  private copy = () => {
    const { error } = this.state;
    if (!error) return;
    const text = `${location.href}\n${navigator.userAgent}\n\n${error.stack ?? error.message}`;
    void navigator.clipboard?.writeText(text).then(() => this.setState({ copied: true }));
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    const stale = isStaleChunk(error);
    return (
      <div className={styles.wrap} role="alert">
        <EmptyState
          icon={TriangleAlert}
          title={stale ? 'Сайт обновился' : 'Эта страница сломалась'}
          description={
            stale
              ? 'Пока вкладка была открыта, вышла новая версия. Обновите страницу.'
              : 'Остальной сайт работает — меню слева. Обновите страницу; если повторяется, скопируйте ошибку и пришлите в чат группы.'
          }
          action={
            <div className={styles.actions}>
              <button type="button" className={buttonClass('primary', 'md')} onClick={() => location.reload()}>
                Обновить страницу
              </button>
              {!stale && (
                <button type="button" className={buttonClass('secondary', 'md')} onClick={this.copy}>
                  {copied ? 'Скопировано' : 'Скопировать ошибку'}
                </button>
              )}
            </div>
          }
        />
        {!stale && (
          <details className={styles.details}>
            <summary>Подробности</summary>
            <pre>{error.message}</pre>
          </details>
        )}
      </div>
    );
  }
}
