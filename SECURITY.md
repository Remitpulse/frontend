# Security Policy

RemitPulse handles passkey-based signing and Stellar/Soroban transaction
construction, so security reports are taken seriously and prioritized over
feature work.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, email the maintainer with a description of the issue, steps to
reproduce, and its potential impact. If the email address is not obvious
from the repository, use the contact on the GitHub profile of the account
that owns this repo.

We'll acknowledge reports as soon as possible and keep you updated as the
issue is investigated and fixed.

## Scope

In scope:

- Passkey/WebAuthn signature handling (`lib/stellar/webauthn.ts`,
  `lib/stellar/signatures.ts`)
- Session key issuance and scoping (`lib/stellar/sessionKeys.ts`,
  `hooks/useSessionKey.ts`)
- Smart account / Soroban transaction construction
  (`lib/stellar/smartAccount.ts`)
- Content-Security-Policy and other security headers (`next.config.ts`)

Out of scope: issues that only affect `NEXT_PUBLIC_DEMO_MODE=true` (mocked
backend, no real funds or keys involved) unless they also reproduce against
real Stellar signing logic.
