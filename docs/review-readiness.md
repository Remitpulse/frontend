# Independent review readiness

Reviewed against fetched `origin/main` commit
`a330a060d4637328e7b74c003a2e36c9b04eca88` (2026-11-05).
This is a source review and local verification, not a security audit or a
confirmation of production settlement. No deployment or blockchain submission
was performed. Existing layout, styles and routes were preserved.

## Implemented versus dependent behavior

| Area              | Evidence and limits                                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet            | Passkey smart-account client; no Freighter or other extension connector. Backend must deploy accounts and provide balances.                                                                                                                                      |
| WebAuthn          | Browser registration/login and assertion prompts; P-256 key extraction, challenge/type check and low-S conversion. Live verification belongs to the backend/account contract. Demo verification is mocked.                                                       |
| Soroban           | RPC simulation, authorization signing, enforcing simulation and XDR assembly exist in `lib/stellar/smartAccount.ts`. Relay rebuilding, fee sponsorship and submission are external.                                                                              |
| Session signing   | Real non-extractable Ed25519 WebCrypto keys in IndexedDB. Live signer registration uses backend-prepared XDR. On-chain scope, expiry and confirmation are not independently verified. Disable deletes the local key; it does not revoke the signer on-chain.     |
| Funding           | Allowlisted SEP-24 portal and backend polling exist. No anchor/backend implementation is included. Sandboxed frames have opaque origins, so their messages cannot pass the current origin check; noopener popups cannot call their opener. Polling is essential. |
| Tracking          | EventSource with polling fallback. Demo status is time-driven sample data, not ledger evidence.                                                                                                                                                                  |
| Quotes/recipients | Quote UI, fee display, corridor input validation and backend interfaces exist. Demo rates, balances, recipients and history are samples. Delivery time, stablecoin availability and zero sender fees depend on external services.                                |

## Corrections in this change

- README framework/tooling versions, design-token path and Proxy path match code.
  Removed unsupported end-to-end production assurances.
- Forward CSP to Next rendering and force dynamic rendering so framework scripts
  can receive each request's nonce, following the installed Next.js CSP guide.
- Replace the CI CSP text-window heuristic (which also flags explanatory comments)
  with executable policy and nonce-forwarding regression checks.
- Permit the configured Stellar RPC origin in `connect-src`, without granting
  iframe access to it.
- Report transfer timeout as unknown status and ask users to check activity;
  aborting a request does not establish whether the relay accepted it.
- Missing, malformed or unapproved live anchor URLs fail closed instead of
  showing a demo funding portal or throwing during URL parsing.
- Align lint tooling with supported dependency peer ranges after `npm install`
  reproduced a TypeScript 7 rejection in typescript-eslint.

## Security investigation still required

These are trust boundaries and unresolved risks, not claims of confirmed fund theft.
Handle confirmed exploitable findings through `SECURITY.md`.

- **Prepared transaction intent:** independently validate backend-prepared signer
  operations, allowed contract/method/arguments and the simulated authorization
  tree against the action the user approved. This frontend signs prepared XDR
  without a complete intent policy. Verify relay rebuilding preserves that intent.
- **Contract verification:** inspect actual `__check_auth` implementation for
  origin/RP-ID hash, user verification, challenge, credential binding, replay
  prevention and signature rules. Client `verifyClientData` checks challenge/type;
  it is not complete WebAuthn assertion verification.
- **Session scope:** prove cap, asset units, cumulative/per-transfer semantics,
  TTL and revocation in contract tests. Same-origin malicious scripts can invoke
  a non-extractable key; non-extractability is not XSS protection. Review async
  account switching and multiple hook instances for stale key state.
- **Authentication:** bearer sessions persist in localStorage; review expiry,
  logout invalidation and XSS exposure. SSE uses cookies while fetch uses bearer
  headers and no cross-origin credential option. Verify backend cookie/CORS/CSRF
  behavior; no cookie establishment is demonstrated here.
- **Submission ambiguity:** timeout wording is corrected, but backend idempotency
  and reconciliation are still needed to prevent duplicate transfers on retry.
- **SEP-24:** validate transaction identity/source and authoritative backend state
  for completion. Test iframe and popup behavior with each real anchor. Review
  polling cancellation and modal reopen state; local UI completion is not proof
  that money was delivered. Failure/refund copy also needs anchor-specific review.
- **Configuration:** `assertConfig()` has no startup caller, validates only a
  subset and does not reject placeholder contract IDs. Mainnet configuration,
  asset issuers, quote expiry and response schema validation need integration tests.
- **Coverage:** no `e2e/` specs exist. Playwright and axe dependencies/configuration
  are scaffolding; accessibility/browser wallet flows are not verified by CI.

## Licensing and attribution

The repository LICENSE is MIT, copyright 2026 Remitpulse, and is unchanged.
Direct packages' installed metadata identifies Next.js, React, Tailwind, ESLint,
SimpleWebAuthn and Vitest as MIT; Stellar SDK and TypeScript as Apache-2.0.
Transitive dependencies have their own terms; package-lock license metadata is
an inventory aid, not a substitute for the actual license/NOTICE files.

Inter is fetched with `next/font/google`; preserve its upstream SIL Open Font
License and copyright notices when distributing font assets. The Figma design
link records a design source, but does not establish permission to redistribute
that design. `components/ui/Icons.tsx` contains SVG paths without a stated
upstream source. Maintainers should confirm icon/design authorship and retain
any required third-party attribution before an independent release. This review
cannot establish provenance from source appearance alone; no project license or
third-party ownership claim has been changed.

## Dependency findings

`npm install` initially reported 11 audit findings (10 moderate, one high).
Updating `follow-redirects` from 1.16.1 to 1.16.2 within its existing range
removed the high advisory GHSA-mrwp-f3q8-3g9p. After tooling alignment, npm
reported eight moderate findings, associated with minimatch and the lint
parser/plugin chain. Do not apply `npm audit fix --force` blindly: its proposed
Next lint configuration downgrade needs separate compatibility review.
ESLint 9.39.5 satisfies the current plugins but npm marks it unsupported;
upgrading back to ESLint 10 requires compatible upstream plugin releases.

## Validation

Validation results are recorded in the pull request. Initial pre-install checks
passed typecheck and 117 tests; lint had six existing effect warnings. After
installation lint failed because typescript-eslint rejects TypeScript 7, leading
to the targeted tooling correction. Default Turbopack build attempts failed on
Google Fonts network access and then restricted local worker-port binding,
including an escalated retry. A webpack build is checked separately; it does not
establish that the default Turbopack build passes in this environment.

Final local results (Node 24.21.0 / npm 11.19.0; `.nvmrc` requests Node 22):

| Command                      | Result                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                | Completed using the existing lockfile; tooling incompatibilities corrected and lockfile updated.                                  |
| `npm run lint`               | Pass, zero errors and six pre-existing effect warnings.                                                                           |
| `npm run typecheck`          | Pass.                                                                                                                             |
| `npm test`                   | Pass, 122 tests in 12 files.                                                                                                      |
| `npm run test:coverage`      | Pass; 59.42% statements, 54.75% branches, 60.71% lines. Smart-account assembly and persistent session keys remain weakly covered. |
| `npm run format:check`       | Pass.                                                                                                                             |
| `npm run build`              | Blocked by environment network/worker-port restrictions; not a passing default-build result.                                      |
| `npm run build -- --webpack` | Pass after tooling correction; all application pages dynamically rendered for nonce CSP.                                          |
| `npm run test:e2e -- --list` | No tests found; browser/accessibility verification remains outstanding.                                                           |
| `npm audit --json`           | Eight moderate findings, no high/critical findings after targeted update.                                                         |

The webpack fallback initially could not resolve path aliases with the original
TypeScript 7 toolchain; the same command passed after TypeScript alignment.
Node 22 CI, default Turbopack build and live integrations remain to be verified
outside this restricted local environment. ESLint 9 is a compatibility compromise,
not a long-term tooling upgrade.
