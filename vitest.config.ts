import { defineConfig } from 'vitest/config'

// Stability/legal/conversion phase (Part 9) — the start of an incremental
// migration off the plain-assert scripts/*.ts suite. New/ported suites
// live as src/**/*.test.ts (conventional Vitest structure, colocated with
// the module they test) and run under plain Node (no DOM needed — every
// suite migrated so far tests pure data/logic, not component rendering).
// See docs/testing.md for which suites are Vitest vs. still the legacy
// scripts/testX.ts + npm run test:x pattern, and why.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
