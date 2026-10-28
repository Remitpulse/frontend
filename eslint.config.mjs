import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import jsxA11y from 'eslint-plugin-jsx-a11y'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  jsxA11y.flatConfigs.recommended,
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