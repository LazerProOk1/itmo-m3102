/**
 * Сервис Google Drive. Компоненты обращаются к `googleDriveService` только через
 * тип `GoogleDriveService` — никогда к Google API напрямую.
 *
 * Сегодня единственная реализация — заглушка ниже: она ничего не запрашивает у Google
 * и явно сообщает, что подключение ещё не настроено. Когда появится настоящая интеграция
 * (Google Identity Services + Drive Picker API), достаточно будет заменить
 * `stubGoogleDriveService` на реальную реализацию с тем же интерфейсом — компоненты,
 * которые его используют (сейчас это `MaterialForm`), не изменятся ни на строчку.
 */

/** Файл, выбранный через Google Drive — в собственной форме приложения, не в «сырых» типах Google API. */
export interface GoogleDriveFile {
  id: string;
  name: string;
  /** Ссылка на файл в интерфейсе Google Drive */
  url: string;
  mimeType?: string;
}

export interface GoogleDrivePickResult {
  file: GoogleDriveFile;
}

/** Всё, что приложению может понадобиться от Google Drive. */
export interface GoogleDriveService {
  /** Есть ли прямо сейчас действующий вход в Google */
  isConnected(): boolean;
  /** Начать вход через Google (OAuth) */
  connect(): Promise<void>;
  /** Открыть системный выбор файла Google Drive и вернуть выбранный файл, или null при отмене */
  pickFile(): Promise<GoogleDrivePickResult | null>;
}

export const googleDriveService: GoogleDriveService = {
  isConnected: () => false,

  async connect() {
    throw new Error('Google Drive is not connected yet.');
  },

  async pickFile() {
    throw new Error('Google Drive is not connected yet.');
  },
};
