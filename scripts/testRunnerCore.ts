// Pure, side-effect-free helpers for scripts/runAllTests.ts, split out so
// they can be exercised directly by scripts/testRunAllTestsRunner.ts
// without actually spawning any processes. This is what fixes the
// Windows bug where `npm run verify` reported 0/17 suites passed even
// though every suite actually passed: spawnSync('npm', ...) silently
// fails to resolve npm.cmd on Windows, and the old code treated that
// failed-to-start process identically to a real failing test suite.

export type Platform = NodeJS.Platform

/** npm/npx ship as npm.cmd/npx.cmd on Windows — spawnSync('npm', ...) without shell:true does not resolve that extension the way a real shell would, so the child process never starts. */
export function resolveNpmCommand(platform: Platform = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm'
}

/**
 * Since Node 18.20.2 / 20.12.2 / 22 (CVE-2024-27980), spawning a .cmd/.bat
 * file on Windows WITHOUT a shell fails immediately with EINVAL — which is
 * exactly what npm.cmd is. So on win32 the runner must spawn through the
 * shell. Safe here: every argument is a fixed script name from our own
 * package.json, never user input.
 */
export function needsShell(platform: Platform = process.platform): boolean {
  return platform === 'win32'
}

export interface SpawnOutcome {
  status: number | null
  error?: Error
}

export type SuiteOutcome = { kind: 'passed' } | { kind: 'failed'; status: number | null } | { kind: 'runner-error'; message: string }

/**
 * Interprets a spawnSync() result, distinguishing three cases that must
 * never collapse into one another:
 *   - the process started, ran the suite, and exited 0            -> passed
 *   - the process started, ran the suite, and exited non-zero     -> failed
 *   - the process never started at all (result.error is set,      -> runner-error
 *     e.g. ENOENT because "npm" doesn't resolve on this platform)
 * The original bug was exactly this last case being silently treated as
 * neither passed nor failed (status stayed null, error was ignored),
 * which is how a broken runner produced a misleading "0/17 passed".
 */
export function interpretSpawnResult(result: SpawnOutcome): SuiteOutcome {
  if (result.error) return { kind: 'runner-error', message: result.error.message }
  if (result.status === 0) return { kind: 'passed' }
  return { kind: 'failed', status: result.status }
}

export interface PackageScripts {
  scripts: Record<string, string>
}

// Excludes 'test:all' (an alias for this exact runner — including it
// would recurse forever) and 'test:unit' (Vitest, already run as its own
// dedicated step, not a legacy scripts/testX.ts suite).
const SELF_REFERENTIAL_SCRIPTS = new Set(['test:all', 'test:unit'])

export function discoverLegacySuiteScripts(pkg: PackageScripts): string[] {
  return Object.keys(pkg.scripts)
    .filter((name) => name.startsWith('test:') && !SELF_REFERENTIAL_SCRIPTS.has(name))
    .sort()
}
