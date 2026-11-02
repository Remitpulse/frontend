# Frontend Audit

Date: 2026-11-02
Scope: `Remitpulse/frontend` (Next.js 16 App Router), branch `feat/remitpulse-frontend`.

This audit is based on a direct inspection of the source tree plus the actual output of
`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run test:coverage`,
and `npm run build`. No results below are fabricated or assumed — each is what the corresponding
command printed on this run.

## Summary

The codebase is in good shape. Typecheck, lint (0 errors), tests (114/114), formatting, and the
production build all pass cleanly after the one fix made in this pass. The project already
implements most of what a "frontend audit" would normally flag as missing in an early-stage app:
a typed API client with timeouts/abort, a documented backend contract, WebAuthn↔Soroban signature
conversion with tests against Node's own crypto, non-extractable session keys, an origin-allowlisted
SEP-24 iframe, a real CSP with nonces (no `unsafe-inline`), and CI that enforces all of the above
plus a dedicated CSP-regression guard.

## Findings

### 1. Fixed — `middleware.ts` used a deprecated Next.js 16 convention

Next.js 16 deprecated the `middleware` file/function convention in favor of `proxy`
(see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` and
`middleware.md` in the same install). `npm run build` printed this exact warning before the fix:

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
To migrate automatically, run: npx @next/codemod@canary middleware-to-proxy .
```

Behavior is identical — only the file and export name change. Fixed by renaming `middleware.ts` →
`proxy.ts`, renaming the exported function `middleware` → `proxy`, and updating every reference:
`next.config.ts` and `app/layout.tsx` comments, and the `csp-guard` job in
`.github/workflows/ci.yml`, which scans `middleware.ts`/`.js` for a CSP regression and now scans
`proxy.ts`/`.js` instead. Verified: the build warning is gone, and typecheck/tests/format all still
pass.

### 2. Six `react-hooks/set-state-in-effect` lint warnings (0 errors)

`npm run lint` reports 6 warnings, all the same new React ESLint rule, in:

- `components/Sep24Modal.tsx:131` — resets `slow` when the modal opens.
- `components/providers/AuthProvider.tsx:37` — loads the session from `localStorage` on mount.
- `components/providers/TransferDraftProvider.tsx:54` — loads the draft from `sessionStorage` on mount.
- `hooks/useAsyncData.ts:41` — triggers the initial fetch.
- `hooks/useQuote.ts:69` — resets the rate-lock countdown when the quote changes.
- `hooks/useSessionKey.ts:112` — clears the session-key record on sign-out.

Each is the standard "hydrate state from an external store on mount/dependency-change" pattern, not
a correctness bug — the rule is a style preference the React team is still refining, not a defect
report. Rewriting all five to lazy initializers / `useSyncExternalStore` would touch five files'
state-management shape with no behavior change and real regression risk (e.g. `useAsyncData`'s
cache-aware initial-loading logic, or the countdown timers), which runs against this audit's
"preserve existing working features, avoid unnecessary rewrites" instruction. Left as-is;
documented here so a reviewer doesn't mistake "0 errors, 6 warnings" for "something was missed."

### 3. No regressions found in wallet/passkey security code

Reviewed `lib/stellar/webauthn.ts`, `signatures.ts`, `smartAccount.ts`, `sessionKeys.ts`, and the
hooks that drive them (`usePasskey`, `useSessionKey`, `useSendTransfer`). All of the following hold
and are exercised by `test/*.test.ts`:

- DER→compact low-S conversion rejects out-of-range/zero `r`/`s` and folds `s` correctly.
- `clientDataJSON.challenge` is checked against the exact Soroban auth payload before any signature
  is used (`verifyClientData`), preventing a passkey assertion for one payload being replayed against another.
- Session-key private keys are generated `extractable: false` and only ever used via
  `crypto.subtle.sign`; the raw key material never exists in JS-readable form.
- `sessionKeyCovers` enforces both expiry and the per-transfer amount cap client-side before a
  session-key signer is even offered — the contract is the actual enforcement point, but the client
  doesn't attempt to misuse an expired/over-cap key either.
- The SEP-24 iframe (`Sep24Modal.tsx`) only renders when `isAllowedOrigin` passes, uses `sandbox`
  without `allow-top-navigation`, and accepts `postMessage` only from the anchor's own origin.

No fabricated balances/rates were found: `lib/api/mock.ts` is only used when
`NEXT_PUBLIC_DEMO_MODE=true`, and `assertConfig()` fails the build-time config check if demo mode is
off and any required contract/backend value is missing.

### 4. CI already gates on everything this audit would otherwise ask for

`.github/workflows/ci.yml` runs typecheck, lint (including `eslint-plugin-jsx-a11y`), format check,
unit tests, coverage, build, a dedicated CSP-regression guard, and conditionally-gated Playwright
E2E + axe-core accessibility jobs. Dependabot is configured (`.github/dependabot.yml`). The
Playwright jobs (`e2e`, `e2e-a11y`) are correctly gated on `hashFiles('e2e/**') != ''` and do not run
yet, because no `e2e/` directory exists — this is accurately self-documented in the workflow
comments, not a bug.

### 5. Documentation is already close to complete

`README.md` documents the architecture, the full backend API contract, every environment variable,
the WebAuthn↔Soroban contract types, and a production checklist. `SECURITY.md` and `CONTRIBUTING.md`
exist. Not present: `CHANGELOG.md` and the `docs/ARCHITECTURE.md` / `docs/WALLET_INTEGRATION.md` /
`docs/BACKEND_INTEGRATION.md` / `docs/TESTING.md` / `docs/ORIGINAL_CONTRIBUTIONS.md` files a fuller
documentation pass would add — intentionally left out of this pass pending a scoping decision (see
final report in conversation).

## Explicitly not done in this pass

- No UI/UX redesign, since the existing design system (Figma-sourced Tailwind tokens, documented in
  `README.md`) is already implemented consistently across every route, and reworking it needs
  product direction, not an unprompted rewrite.
- No changes to `lib/api/client.ts`'s endpoint surface: it already matches the backend contract
  documented in `README.md` exactly, and the `Remitpulse/backend` repo is not available in this
  workspace to verify against a live API spec.
- No new tests added beyond what exists (114 passing, covering signature math, hook lifecycles, CSP
  building, filters, and formatting) — the existing suite already separates demo-mode (mocked) from
  what would be live-Testnet verification, and there's no indication additional coverage is needed
  without a specific gap being named.
