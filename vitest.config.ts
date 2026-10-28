import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  test: {
    // Plain .ts tests (format/stellar/webauthn/filters/csp) are pure Node logic;
    // running them under jsdom breaks `instanceof Uint8Array` checks across
    // realms (@stellar/stellar-sdk's XDR codecs fail with "expected a string
    // or Uint8Array, got object"). The hook tests (.tsx, using
    // @testing-library/react's renderHook) opt into jsdom individually via a
    // `// @vitest-environment jsdom` docblock at the top of each file.
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['hooks/**/*.ts', 'lib/**/*.ts'],
      exclude: ['**/*.d.ts', '**/node_modules/**', '**/test/**', '**/*.config.*'],
    },
  },
})
