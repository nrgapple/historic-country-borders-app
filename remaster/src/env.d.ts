/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Optional Google Analytics 4 measurement ID (public by design). */
  readonly PUBLIC_GA_FOUR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
