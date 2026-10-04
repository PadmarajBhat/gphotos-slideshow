/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Set to "true" by the GitHub Pages workflow. A static host has no helper
   * process, so the Google Photos source is explained rather than attempted.
   */
  readonly VITE_STATIC_HOSTING?: string;
  /** Repository URL, injected at build time to link to self-hosting docs. */
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
