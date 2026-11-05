import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Exercise the upstream parser's minimatch-dependent allowDefaultProject path,
// which ordinary untyped eslint runs do not reach. This guards the scoped override.
const require = createRequire(import.meta.url)
const nextRequire = createRequire(require.resolve('eslint-config-next'))
const toolingRequire = createRequire(nextRequire.resolve('typescript-eslint'))
const parser = toolingRequire('@typescript-eslint/parser') as {
  parseForESLint: (code: string, options: object) => { ast: { type: string } }
}

describe('patched parser glob integration', () => {
  it('allows only the configured default-project file', () => {
    const options = {
      filePath: path.resolve('audit-parser-fixture.js'),
      tsconfigRootDir: path.resolve('.'),
      projectService: { allowDefaultProject: ['audit-parser-fixture.js'] },
    }
    expect(parser.parseForESLint('const amount = 10', options).ast.type).toBe('Program')
    expect(() =>
      parser.parseForESLint('const amount = 10', {
        ...options,
        filePath: path.resolve('not-allowed.js'),
      }),
    ).toThrow(/not found by the project service/)
  }, 30_000)
})
