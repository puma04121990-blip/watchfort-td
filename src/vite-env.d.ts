/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GP_PROJECT_ID?: string;
  readonly VITE_GP_PUBLIC_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
