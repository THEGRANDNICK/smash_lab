// Phase 9 — a single source of truth for the version shown in the admin
// footer. package.json's own "version" field is that source of truth
// (currently "0.8.0-beta.0", a valid semver prerelease); vite.config.ts
// reads it at build time and injects it as import.meta.env.APP_VERSION
// (see that file's comment) so it's never hand-typed a second time in any
// component. Nothing here reads a secret env var, a service-role key, or
// any deployment credential — only the public, already-committed
// package.json version number.
//
// Split into pure formatting/labeling functions (fully testable without
// Vite) and one thin `getRuntimeVersionInfo()` wiring function (reads the
// real import.meta.env values, following the same `?.`-guarded pattern
// already established in lib/supabase.ts for values that are only
// statically replaced under an actual Vite build — under plain `tsx`
// script execution, import.meta.env is undefined, so this falls back to
// a clearly-labeled default rather than crashing).

export type Environment = 'Production' | 'Development'

export interface VersionInfo {
  /** The raw package.json version string, e.g. "0.8.0-beta.0". */
  raw: string
  /** The shortened, display-friendly form, e.g. "v0.8.0-beta". */
  display: string
  environment: Environment
}

/**
 * Formats a semver string for display, dropping a trailing ".0"
 * prerelease build-number segment (e.g. "0.8.0-beta.0" -> "v0.8.0-beta")
 * since a ".0" build number is the default/first prerelease build and
 * reads as noise in a short UI label. A non-zero build number (e.g.
 * "0.8.0-beta.1") is kept — dropping it would misrepresent which build
 * this actually is.
 */
export function formatDisplayVersion(raw: string): string {
  const shortened = raw.replace(/-([a-zA-Z][a-zA-Z0-9]*)\.0$/, '-$1')
  return `v${shortened}`
}

export function resolveEnvironmentLabel(isProd: boolean | undefined): Environment {
  return isProd ? 'Production' : 'Development'
}

export function buildVersionInfo(raw: string, isProd: boolean | undefined): VersionInfo {
  return { raw, display: formatDisplayVersion(raw), environment: resolveEnvironmentLabel(isProd) }
}

/** Real wiring point — reads Vite's statically-replaced build-time values. Never throws; falls back to a clearly-labeled "unknown" version outside a Vite build (e.g. a script run with plain tsx) rather than guessing. */
export function getRuntimeVersionInfo(): VersionInfo {
  const raw = import.meta.env?.APP_VERSION ?? '0.0.0-unknown'
  return buildVersionInfo(raw, import.meta.env?.PROD)
}
