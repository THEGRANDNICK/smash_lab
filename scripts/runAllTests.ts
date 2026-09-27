// The one obvious "run everything" command (Part 8) — `npm test` and its
// `npm run test:all` alias both point here. Runs every real test suite in
// the project: the new-style Vitest suites (src/**/*.test.ts) plus every
// remaining legacy plain-assert scripts/testX.ts suite (see
// docs/testing.md for the full inventory and which category each suite
// is in). Each legacy suite is spawned as its own `tsx` process — exactly
// what `npm run test:x` already runs — rather than imported in-process,
// because several of them call `process.exit(1)` directly on failure,
// which would kill this whole run after the first failing suite instead
// of finishing and reporting on all of them.
//
// Cross-platform note: every suite (including Vitest) is launched via
// `npm run <script>`, resolved through resolveNpmCommand() (npm.cmd on
// Windows, npm elsewhere) rather than calling `npx`/`npm` directly —
// spawnSync() does not reliably resolve npm/npx on Windows otherwise,
// since they're npm.cmd/npx.cmd there. See testRunnerCore.ts for the pure
// resolution/interpretation logic and testRunAllTestsRunner.ts for its
// regression tests.
//
// Intentionally excluded: verify:supabase / verify:catalog (need real
// Supabase credentials to run at all — see their own scripts) are
// diagnostics, not part of the no-setup-required test suite.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveNpmCommand, needsShell, interpretSpawnResult, discoverLegacySuiteScripts, type SuiteOutcome } from './testRunnerCore.js'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')) as {
  scripts: Record<string, string>
}

const npmCommand = resolveNpmCommand()
const LEGACY_SUITE_SCRIPTS = discoverLegacySuiteScripts(pkg)

interface SuiteResult {
  name: string
  outcome: SuiteOutcome
}

const results: SuiteResult[] = []

function runNpmScript(name: string, scriptName: string) {
  console.log(`\n=== npm run ${scriptName} ===\n`)
  const result = spawnSync(npmCommand, ['run', '--silent', scriptName], { stdio: 'inherit', shell: needsShell() })
  const outcome = interpretSpawnResult(result)
  if (outcome.kind === 'runner-error') {
    console.error(`\n${name} could not be started (runner error, not a test failure): ${outcome.message}`)
  }
  results.push({ name, outcome })
}

console.log('=== Vitest suites (src/**/*.test.ts) ===\n')
runNpmScript('vitest', 'test:unit')

for (const scriptName of LEGACY_SUITE_SCRIPTS) {
  runNpmScript(scriptName, scriptName)
}

console.log('\n=== Summary ===')
for (const r of results) {
  const icon = r.outcome.kind === 'passed' ? '✓' : r.outcome.kind === 'runner-error' ? '⚠' : '✗'
  const detail = r.outcome.kind === 'runner-error' ? ` — runner error: ${r.outcome.message}` : ''
  console.log(`  ${icon} ${r.name}${detail}`)
}

const passed = results.filter((r) => r.outcome.kind === 'passed')
const failed = results.filter((r) => r.outcome.kind === 'failed')
const runnerErrors = results.filter((r) => r.outcome.kind === 'runner-error')

console.log(`\n${passed.length}/${results.length} suites passed.`)
if (failed.length > 0) console.log(`Failed: ${failed.map((r) => r.name).join(', ')}`)
if (runnerErrors.length > 0) console.log(`Runner errors (process never started — not a test failure): ${runnerErrors.map((r) => r.name).join(', ')}`)
if (failed.length > 0 || runnerErrors.length > 0) {
  process.exit(1)
}
