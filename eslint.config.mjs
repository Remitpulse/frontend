import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// eslint-config-next/core-web-vitals already registers the jsx-a11y plugin
// and its rules. Adding eslint-plugin-jsx-a11y's own flat config on top
// re-registers the same plugin under the same name, which ESLint rejects
// ("Cannot redefine plugin"), and its latest release (6.10.2) only supports
// eslint up to v9, conflicting with this repo's eslint v10. Rely on Next's
// bundled jsx-a11y rules instead of a second, redundant dependency.
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // These React Compiler rules landed as "error" with eslint-config-next 16.
      // The flagged spots are intentional (one-time localStorage/sessionStorage
      // reads on mount, countdown timers using Date.now()), not bugs, so keep
      // them visible without failing the build.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]

export default eslintConfig
