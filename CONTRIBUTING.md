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
