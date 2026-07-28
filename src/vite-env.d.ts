/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Injected by vite.config.ts from package.json's own "version" field — never a secret, see src/logic/version.ts. */
  readonly APP_VERSION?: string
}
