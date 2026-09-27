// Regression tests for scripts/runAllTests.ts's cross-platform command
// resolution (see testRunnerCore.ts). Exists because a prior version of
// the runner called spawnSync('npm', ...) / spawnSync('npx', ...)
// directly, which silently fails to resolve npm.cmd/npx.cmd on Windows —
// the child process never started, spawnSync returned status: null, and
// that got misreported as "0/17 suites passed" instead of a runner
// error. These tests exercise the pure resolution/interpretation logic
// directly (no real process spawning), so that regression can't recur
// silently.
//
// Run: npm run test:runner

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveNpmCommand, needsShell, interpretSpawnResult, discoverLegacySuiteScripts } from './testRunnerCore.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log('=== Cross-platform npm command resolution ===')

test('resolveNpmCommand uses npm.cmd on win32 (spawnSync cannot resolve bare "npm" there)', () => {
  assert.equal(resolveNpmCommand('win32'), 'npm.cmd')
})
test('needsShell is true on win32 (Node refuses to spawn npm.cmd without a shell: EINVAL)', () => {
  assert.equal(needsShell('win32'), true)
})
test('needsShell is false on linux and darwin', () => {
  assert.equal(needsShell('linux'), false)
  assert.equal(needsShell('darwin'), false)
})
test('resolveNpmCommand uses plain npm on linux', () => {
  assert.equal(resolveNpmCommand('linux'), 'npm')
})
test('resolveNpmCommand uses plain npm on darwin', () => {
  assert.equal(resolveNpmCommand('darwin'), 'npm')
})

console.log('\n=== spawnSync result interpretation ===')

test('a process that started and exited 0 is "passed"', () => {
  const outcome = interpretSpawnResult({ status: 0 })
  assert.equal(outcome.kind, 'passed')
})
test('a process that started and exited non-zero is "failed", never silently passed', () => {
  const outcome = interpretSpawnResult({ status: 1 })
  assert.equal(outcome.kind, 'failed')
  assert.equal(outcome.kind === 'failed' && outcome.status, 1)
})
test('a process that never started (spawnSync error, e.g. Windows ENOENT on "npm") is a distinct "runner-error", never "passed" or silently "failed" with a null status', () => {
  const enoent = Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' })
  const outcome = interpretSpawnResult({ status: null, error: enoent })
  assert.equal(outcome.kind, 'runner-error')
  assert.equal(outcome.kind === 'runner-error' && outcome.message, 'spawn npm ENOENT')
  assert.notEqual(outcome.kind, 'passed')
})
test('a killed-by-signal process (status null, no spawn error) still reports as "failed", not "passed"', () => {
  const outcome = interpretSpawnResult({ status: null })
  assert.equal(outcome.kind, 'failed')
})

console.log('\n=== Legacy suite discovery ===')

test('discoverLegacySuiteScripts excludes test:all and test:unit but includes other test: scripts, sorted', () => {
  const pkg = {
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
      test: 'tsx scripts/runAllTests.ts',
      'test:all': 'tsx scripts/runAllTests.ts',
      'test:unit': 'vitest run',
      'test:zebra': 'tsx scripts/testZebra.ts',
      'test:alpha': 'tsx scripts/testAlpha.ts',
    },
  }
  const discovered = discoverLegacySuiteScripts(pkg)
  assert.deepEqual(discovered, ['test:alpha', 'test:zebra'])
})
test('discoverLegacySuiteScripts against the real package.json includes this suite itself (auto-registration)', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as { scripts: Record<string, string> }
  const discovered = discoverLegacySuiteScripts(pkg)
  assert.ok(discovered.includes('test:runner'), 'expected "test:runner" to be registered in package.json and auto-discovered')
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
