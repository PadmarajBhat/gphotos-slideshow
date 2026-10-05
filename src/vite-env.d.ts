/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "true" by the GitHub Pages workflow. */
  readonly VITE_STATIC_HOSTING?: string;
  /** Repository URL, injected at build time to link to the docs. */
  readonly VITE_REPO_URL?: string;
  /**
   * Base URL of the photo helper when it isn't on the same origin, e.g. the
   * Cloud Run service behind the GitHub Pages site.
   */
  readonly VITE_HELPER_URL?: string;
  /** "true" once accepted into Google's Photos partner program. */
  readonly VITE_AMBIENT_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
