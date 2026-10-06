/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" — сборка с редактированием на сайте (ветка react-app-dev), иначе только просмотр */
  readonly VITE_EDITING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
