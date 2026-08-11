/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_WALLET_STORAGE_URL?: string;
  readonly VITE_BSV_NETWORK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
