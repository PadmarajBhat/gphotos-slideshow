/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional deployment-wide Google OAuth Web Client ID. When set at build time
   * users do not have to paste their own ID in Settings.
   */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
