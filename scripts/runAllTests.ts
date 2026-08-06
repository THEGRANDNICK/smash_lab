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
// Intentionally excluded: verify:supabase / verify:catalog (need real
// Supabase credentials to run at all — see their own scripts) are
// diagnostics, not part of the no-setup-required test suite.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')) as {
  scripts: Record<string, string>
}

// Excludes 'test:all' (an alias for this exact script — running it here
// would recurse forever) and 'test:unit' (vitest, already run separately
// above, not a legacy scripts/testX.ts suite).
const SELF_REFERENTIAL_SCRIPTS = new Set(['test:all', 'test:unit'])
const LEGACY_SUITE_SCRIPTS = Object.keys(pkg.scripts)
  .filter((name) => name.startsWith('test:') && !SELF_REFERENTIAL_SCRIPTS.has(name))
  .sort()

interface SuiteResult {
  name: string
  ok: boolean
}

const results: SuiteResult[] = []

console.log('=== Vitest suites (src/**/*.test.ts) ===\n')
{
  const { status } = spawnSync('npx', ['vitest', 'run'], { stdio: 'inherit' })
  results.push({ name: 'vitest', ok: status === 0 })
}

for (const scriptName of LEGACY_SUITE_SCRIPTS) {
  console.log(`\n=== npm run ${scriptName} ===\n`)
  const { status } = spawnSync('npm', ['run', '--silent', scriptName], { stdio: 'inherit' })
  results.push({ name: scriptName, ok: status === 0 })
}

console.log('\n=== Summary ===')
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} suites passed.`)
if (failed.length > 0) {
  console.log(`Failed: ${failed.map((r) => r.name).join(', ')}`)
  process.exit(1)
}
