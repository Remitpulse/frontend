# Readiness follow-up

Base: `c54ee6cf4b59120e6c7af85045d1ea00ac326055` (`main`, includes PR #55).
Work is isolated in `/tmp/remitpulse-readiness`; the original workspace and its
local environment files are preserved. This is a frontend review with automated
checks, not a contract audit or proof of real-world settlement.

## Changes and regression coverage

- Removed all six effect warnings by changing state ownership rather than
  suppressing rules. Auth and per-tab draft restoration use hydrated external
  stores with stable server snapshots. Draft restoration completes before send
  routes mount, preventing refresh redirects from losing a review in progress.
- Async data ignores old-account and post-logout responses. Quote countdowns are
  derived from the quote and timer clock, and stale input/quote combinations
  cannot continue during debounce. Modal state resets on mount/transaction change;
  closed modals cannot schedule further polling after an in-flight request ends.
- Session-key state is shared by hook instances. Disable invalidates captured
  signers and notifies other tabs with BroadcastChannel; persisted removal waits
  for the IndexedDB transaction to commit. Expiry and positive finite amounts/caps
  are checked at signer selection and signing. Issuance cannot persist after a
  detected session invalidation. Storage failures are surfaced.
- Registration/login explicitly require user verification. Signing also checks
  credential ID, challenge, ceremony type, actual page origin and cross-origin
  context. These are defense-in-depth checks, not server-side signature verification.
- Authorization signing rejects multiple operations, unsupported/delegated/source
  credentials, foreign accounts, missing/extra auth entries, changed contract,
  method, recipient or amount, and nested authorization calls. The supported path
  is a single contract invocation and a single address authorization. An ABI
  requiring broader authorization needs explicit review, not a looser fallback.
- Transfer confirmation rejects expired/invalid quotes, nonpositive or overprecision
  amounts and send-currency/asset mismatches before prompting or submitting.
- Added six Chromium journeys and axe checks. Virtual CTAP2 ceremonies, low-S
  conversion, WebCrypto keys and IndexedDB are real. Backend verification, rates,
  balances, anchor funding and delivery are explicitly demo data. Browser requests
  outside localhost/127.0.0.1 are blocked; no RPC/relay/anchor is contacted.
- Browser checks reproduce and fix low contrast for the demo warning and completed
  status labels, selected payout details and review guidance. Only those text
  shades change; layout and design remain.
  Delivery radio controls now have a named radio group.
- CI runs one combined browser/accessibility suite, without job-level `hashFiles`
  gating or duplicate E2E jobs. Lint enforces `--max-warnings=0` and React Compiler
  rules use the upstream error severity. The verify job also runs a dependency audit.

## Investigation of all eight dependency findings

All eight original moderate npm audit entries are the same underlying advisory,
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), propagated
through the development-only lint dependency chain. They are not eight independent
runtime flaws.

| Reported package                     | Dependency path to the advisory        | Resolution                        |
| ------------------------------------ | -------------------------------------- | --------------------------------- |
| minimatch                            | typescript-estree → minimatch 10.2.6   | Version-scoped override to 11.0.3 |
| @typescript-eslint/typescript-estree | direct vulnerable minimatch dependency | Same override                     |
| @typescript-eslint/parser            | typescript-estree                      | Same override                     |
| @typescript-eslint/type-utils        | typescript-estree                      | Same override                     |
| @typescript-eslint/utils             | typescript-estree                      | Same override                     |
| @typescript-eslint/eslint-plugin     | parser/type-utils/utils                | Same override                     |
| typescript-eslint                    | plugin/parser/typescript-estree/utils  | Same override                     |
| eslint-config-next                   | typescript-eslint                      | Same override                     |

There is no patched minimatch 10 release in the registry at review time; even
[typescript-estree 8.72.1](https://github.com/typescript-eslint/typescript-eslint/blob/v8.72.1/packages/typescript-estree/package.json)
still requests minimatch 10. A broad npm audit force-fix suggests downgrading the
Next lint config, which is not justified here. Instead the override applies only
to **typescript-estree 8.72.0**, leaving minimatch 3 consumers alone. The installed
parser uses the named `minimatch(path, pattern, { dot: true })` function, retained
in [minimatch 11](https://github.com/isaacs/minimatch/tree/v11.0.3); both installed
and patched versions specify the same Node engine range. A real parser project-service
integration test checks allowed and rejected `allowDefaultProject` file patterns,
a path that ordinary untyped lint does not exercise. Normal lint, typecheck,
tests and builds also validate the combination.

This is a deliberate, narrowly scoped cross-major override, not an upstream support
guarantee. Maintainers should remove it once the parent officially supports a
fixed version and keep the parser regression/audit checks when upgrading tooling.
ESLint 9's upstream deprecation from the first review remains; moving to ESLint 10
still requires compatible versions of every plugin, not ignoring peer conflicts.

## Remaining security boundaries and manual review

1. **Prepared session signer operations — high priority:** the new checks bind RPC
   authorization to the transaction being signed. For a normal transfer that
   transaction is constructed locally from the reviewed quote. For `signPreparedXdr`
   the transaction itself still comes from the backend. Its signer key, asset scope,
   cap and TTL are not validated against a reviewed contract ABI. Do not treat root
   equality as complete intent validation. Inspect the deployed ABI and build or
   validate the exact signer-management invocation locally before enabling live
   quick-send in a funds-bearing environment.
2. **Session limits/finality/revocation:** browser caps are per transfer in nominal
   send-asset units, not a cumulative budget or a proven on-chain policy. Backend
   acceptance is marked registered without independent finality verification.
   Local disable deletes a browser key; it does not remove a signer from the smart
   account, invalidate previously signed authorizations, or revoke copies held by
   another browser/device. Integrate and test real contract revocation/expiry.
   BroadcastChannel propagation is browser-dependent; Chromium is covered here.
3. **WebAuthn verification:** review the backend/account contract for signature and
   P-256 key binding, RP-ID hash, UP/UV flags, server-side challenge lifecycle,
   replay protection, accepted origins and cross-origin policy. Client-side checks
   and virtual-authenticator E2E are not proof of these properties or of hardware
   authenticator compatibility.
4. **Relay and quotes:** verify the quote payee/asset/amount policy with the backend,
   transaction rebuilding, fee sponsorship and contract simulation on testnet through
   an independently authorized integration procedure. Backend idempotency and status
   reconciliation remain necessary after ambiguous timeouts. No transactions were
   submitted in this review.
5. **Auth/SSE/anchors:** localStorage bearer-token exposure and expiry/logout
   invalidation remain backend concerns. SSE cookie setup/CORS is not demonstrated.
   SEP-24 callbacks still need transaction/source binding and authoritative backend
   confirmation; opaque iframe origins/noopener mean polling is essential. Real
   anchors, legal copy and integration configuration require manual review.
6. **Licensing:** LICENSE is unchanged. The prior report's Figma/icon provenance and
   third-party font/dependency notice checks remain maintainer actions. The newly
   introduced development-only `@isaacs/nonrecursive-glob-match` 1.0.3 and patched
   minimatch carry BlueOak-1.0.0; the installed `LICENSE.md` was inspected and is
   retained in their packages. No code was copied or project licensing changed.

## Verification

Exact final command results are recorded below and in the PR. All browser tests
run against a local production build in demo mode. This suite does not submit
blockchain transactions or deploy anything. A clean npm ci verifies the override
and lockfile before the final checks.

| Check                                       | Final result                                                                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`, then clean `npm ci`          | Pass; scoped override and lockfile reproduced. Install used Node 24.21.0 / npm 11.19.0.                                                                                                            |
| `npm run lint -- --max-warnings=0`          | Pass: **zero errors, zero warnings** on Node 22.23.2 / npm 10.9.8.                                                                                                                                 |
| `npm run typecheck`                         | Pass on Node 22.23.2.                                                                                                                                                                              |
| `npm test`                                  | **157 passed, 17 files** on Node 22.23.2.                                                                                                                                                          |
| `npm run test:coverage`                     | Pass: **68.44% lines** (499/729), **66.50% statements** (548/824), **64.32% branches** (330/513), **53.63% functions** (118/220). Same 157 tests pass.                                             |
| `npm run test:e2e`                          | **6 passed**, Chromium, Node 22.23.2, 55.3 seconds including the local default production build/start. No retries used. Axe reports no WCAG 2 A/AA violations on the four checked screens.         |
| `npm audit --json`                          | **0 vulnerabilities**, full dependency tree.                                                                                                                                                       |
| `npm audit --omit=dev --json`               | **0 vulnerabilities**, production dependencies.                                                                                                                                                    |
| `npm run build`                             | Default Turbopack build passes; environment restriction from the initial review is no longer reproduced in this isolated worktree. Browser tests also build with the default bundler, not webpack. |
| `npm run format:check`, `git diff --check`  | Pass.                                                                                                                                                                                              |
| Changed-file review and secret-pattern scan | No private-key, Stellar seed, AWS-key or GitHub-token patterns; no local environment/key files in the change set. `.env.example` contains documented public placeholders only. LICENSE unchanged.  |

Browser tests request reduced motion to avoid measuring colors in transient fade
animations. Initial runs identified real warning/status/selected-control contrast
failures; those colors were fixed without disabling axe rules. Automated checks
are not a manual accessibility audit or a cross-browser/hardware-authenticator test.
Coverage is improved from the initial 60.71% line result, but substantial RPC
assembly and persistent storage error paths remain outside unit coverage; E2E
exercises successful browser storage and demo signing, not deployed contracts.

The final Node 22 checks match `.nvmrc`. GitHub Actions status should still be
checked on the PR before merge; local passes do not assert hosted CI success.
Before any funds-bearing release, complete the manual contract/backend/anchor and
licensing checks above. No deployment, blockchain submission, funding document,
or merge was performed.
