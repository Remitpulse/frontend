# Contributing

## Setup

```bash
nvm use        # or install the Node version in .nvmrc
npm install
cp .env.example .env.local   # fill in or leave blank to use demo mode
npm run dev
```

Set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` to run against the mocked
backend in [`lib/api/mock.ts`](lib/api/mock.ts) — passkey ceremonies and
signature math stay real, only the backend calls are faked.

## Pre-commit hook

`npm install` sets up [husky](https://typicode.github.io/husky/) and installs
a `pre-commit` hook backed by [lint-staged](https://github.com/lint-staged/lint-staged).
On commit, the hook runs:

- `eslint --fix` on staged JS/TS files
- `prettier --write` on staged files

Only staged files are touched, so the hook stays fast. Fixes are applied and
re-staged automatically; if ESLint reports an error it can't fix, the commit
is blocked until you resolve it.

The hook deliberately does **not** run `typecheck`, `test`, or `build` — those
are slower and run in CI. If you need to skip the hook (e.g. a WIP commit),
use `git commit --no-verify`, but make sure CI is green before opening a PR.

## Before opening a PR

Run everything CI runs:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run format` applies Prettier; `npm run format:check` checks without
writing.

## Commit style

Keep commits focused and use a short, imperative subject line (optionally
prefixed with `feat:`, `fix:`, `chore:`, `docs:`, `ci:`, etc.).

## Pull requests

Fill in the PR template's test plan honestly — reviewers use it to decide
how much manual testing to redo. For UI changes, include a screenshot or
clip of the affected flow.