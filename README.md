# RemitPulse

<p align="center"><strong>Money moves. Life happens.</strong></p>
<p align="center">Passkey-secured cross-border remittances on Stellar / Soroban — no seed phrases, no network fees, real stablecoin rails.</p>

<p align="center">
  <a href="https://github.com/Remitpulse/frontend/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Remitpulse/frontend/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="Stellar Soroban" src="https://img.shields.io/badge/Stellar-Soroban-7D00FF?logo=stellar&logoColor=white">
  <img alt="WebAuthn" src="https://img.shields.io/badge/Auth-WebAuthn%20passkeys-10B981">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-blue">
</p>

RemitPulse is a full passkey-native wallet front end for sending stablecoins (USDC · EURC · ARST · BRLA) across
borders on Stellar/Soroban. There's no browser extension, no seed phrase to back up, and no network fee for the
sender — every ceremony is a biometric prompt, every signature is verified against a Soroban smart account, and
every transfer is tracked live from "payment received" to "delivered."

Built with **Next.js 15 (App Router) + Tailwind CSS**, it implements the full WebAuthn ↔ Soroban signature bridge
end to end: DER-to-compact-low-S conversion, `authorizeEntry` auth-entry signing, non-extractable Ed25519 session
keys for quick-send, and a SEP-24 anchor flow for fiat funding — all documented below with the exact file that
does each job.

### Why it stands out

- **No custodial key handling, anywhere.** Passkey private keys live in the authenticator's secure enclave; session
  keys are WebCrypto `CryptoKey`s created `extractable: false`. Nothing sensitive ever touches a JS variable.
- **The hard cryptography is solved, not stubbed.** WebAuthn gives you an ASN.1 DER ECDSA signature; Soroban's
  `secp256r1_verify` wants a fixed 64-byte low-S `r ‖ s`. [`lib/stellar/webauthn.ts`](lib/stellar/webauthn.ts) does
  that conversion correctly, with tests that check it against Node's own crypto implementation.
- **Session keys that know their limits.** Quick-send is an on-chain-scoped signer (capped amount + TTL), not a
  client-side convenience flag — so "remember me" can't be abused into unlimited spend.
- **Real-time, not polling-and-hoping.** Transfer status streams over SSE with an automatic fallback, and funding
  via SEP-24 is detected through `postMessage` with backend polling as the safety net.
- **A demo mode that doesn't lie to you.** `NEXT_PUBLIC_DEMO_MODE=true` mocks the backend, but passkey ceremonies
  and signature math are 100% real — so what you click through locally is the same cryptography that ships to
  mainnet.

---

## 🎨 Design

**Figma Design File: https://www.figma.com/design/HNvkClSYNDvQJLVB3bNaC6/RemitPule?node-id=0-1&p=f&t=BAh716aGwTH4bRvq-0**

Design tokens come straight from the Figma "14 · Design system & interaction states" frame and live in
[`tailwind.config.ts`](tailwind.config.ts):

| Token | Value | Tailwind |
| --- | --- | --- |
| Navy | `#0A192F` | `navy` |
| Royal blue | `#2563EB` | `royal` |
| Mint | `#10B981` | `mint` (accent only; small success text uses `mint-dark`) |
| Ink | `#1E293B` | `ink` |
| Muted | `#64748B` | `muted` |
| Border | `#E2E8F0` | `border` |
| Background | `#F8FAFC` | `surface` |
| Type | Inter · 32/24/20/16/14/12 | `font-sans`, `text-body`, `text-label`, `text-caption` |
| Layout | 390 px mobile · 24 px margins · 12–18 px radii · 52 px actions · 480 px flow container · 232 px sidebar | `max-w-flow`, `h-action`, `w-sidebar` |

### Screen map (Figma frame → route)

| Figma frame | Route |
| --- | --- |
| 01 · Welcome & passkey onboarding / M04 · Couldn’t verify your passkey | `/` |
| 02 · Send money calculator | `/send` |
| 03 · Recipient details / 10 · Cash pickup recipient | `/send/recipient` |
| 04 · Review & biometric authorization | `/send/review` |
| 05 · Secure partner funding gateway (SEP-24) | `<Sep24Modal>` on `/send/review` and `/wallet` |
| 06 · Live transaction tracking / 16 · Delivered | `/transfers/[id]` |
| 07 · Mobile dashboard / 09 · Desktop dashboard | `/dashboard` |
| 08 · Account & passkey settings | `/settings` |
| M07 Activity · M12 Recipients · M18 Your wallet | `/activity`, `/recipients`, `/wallet` |

### App layout mockups

```
 ┌──────────────────────────────┐  ┌──────────────────────────────┐  ┌──────────────────────────────┐
 │ ███████████ NAVY ███████████ │  │ ‹  Send money             ⓘ │  │ ‹  Track transfer         ⓘ │
 │ [➤] RemitPulse               │  │ 1 of 3 · Amount              │  │                              │
 │ ( BORDERLESS BY DESIGN )     │  │ ━━━━━━━━━ ───────── ──────── │  │ ( TRANSFER IN PROGRESS )     │
 │                              │  │                              │  │ On its way to María.         │
 │ Closer to home.              │  │ A little goes a long way.    │  │ Expected in under 1 minute   │
 │ In every transfer.           │  │ Send to Mexico, from phone.  │  │                              │
 │ Send money worldwide in      │  │ ┌──────────────────────────┐ │  │ 8,557.85 MXN                 │
 │ moments, zero hidden fees.   │  │ │ You send                 │ │  │ ┌──────────────────────────┐ │
 │                              │  │ │ 500.00     (US USD·USDC▾)│ │  │ │ ✔ Payment received        │ │
 │  ┌──────┐            ┌─────┐ │  │ └──────────────────────────┘ │  │ │ │ Your $500.00 confirmed.  │ │
 │  │US    │ ──(→)───── │MX   │ │  │ ┌──────────────────────────┐ │  │ │ ✔ Converted to dig. $     │ │
 │  │$500  │            │8,558│ │  │ │ They receive    (royal)  │ │  │ │ │ Rate locked 17.15 MXN    │ │
 │  └──────┘ (< 1 min)  └─────┘ │  │ │ 8,557.85   (MX MXN·USDC▾)│ │  │ │ ● Settling on Stellar     │ │
 │██████████████████████████████│  │ └──────────────────────────┘ │  │ │ │ Moving securely…         │ │
 │                              │  │ ✓ 1 USD = 17.15 MXN  🔒05:00 │  │ │ 🏦 Deposited to bank       │ │
 │ Your account.                │  │ RemitPulse fee        $0.00  │  │ └──────────────────────────┘ │
 │ Your fingerprint.            │  │ Partner fee           $1.00  │  │ ┌──────────────────────────┐ │
 │ Face ID, Touch ID or PIN.    │  │ Network fee (sponsor) $0.00  │  │ │ Reference RP-261023-… ⧉ │ │
 │ ┌──────────────────────────┐ │  │ Amount converted    $499.00  │  │ │ Recipient   María López │ │
 │ │ Create account w/ passkey☝│ │  │ How should it arrive?        │  │ │ Delivery BBVA ••••7890 │ │
 │ └──────────────────────────┘ │  │ ┌────────────┐ ┌───────────┐ │  │ └──────────────────────────┘ │
 │ ┌──────────────────────────┐ │  │ │🏦 Bank   ✔│ │💵 Cash    │ │  │ ● Live updates · just now    │
 │ │   Log in with passkey    │ │  │ │SPEI <1 min│ │MoneyGram  │ │  │ ┌──────────────────────────┐ │
 │ └──────────────────────────┘ │  │ └────────────┘ └───────────┘ │  │ │  Share tracking link  🔗 │ │
 │ 🛡 Biometric   🌐 Stellar    │  │ ┌──────────────────────────┐ │  │ └──────────────────────────┘ │
 │                              │  │ │  Continue to recipient → │ │  │      Back to dashboard       │
 │                              │  │ └──────────────────────────┘ │  │                              │
 └──────────────────────────────┘  └──────────────────────────────┘  └──────────────────────────────┘
        01 · Onboarding                  02 · Transfer calculator             06 · Status tracker
```

---

## ✨ What's implemented

- **1-click passkey signup / login.** Standard WebAuthn (ES256 only, since Soroban verifies secp256r1) via
  `@simplewebauthn/browser`. Discoverable credentials, so login needs no username. Copy for failures follows the M04 recovery state.
- **DER → raw low-S `r || s`.** WebAuthn assertions return ASN.1 DER signatures. The `usePasskey` hook
  ([`hooks/usePasskey.ts`](hooks/usePasskey.ts)) converts them with
  [`derToCompactLowS`](lib/stellar/webauthn.ts) into the 64-byte `r || s` that Soroban's `secp256r1_verify` accepts,
  folding `s` into the lower half of the P-256 order *n*. It also checks that `clientDataJSON.challenge` equals the
  Soroban auth payload before anything is sent.
- **Ed25519 session keys** ([`lib/stellar/sessionKeys.ts`](lib/stellar/sessionKeys.ts), [`hooks/useSessionKey.ts`](hooks/useSessionKey.ts)).
  WebCrypto generates the key as *non-extractable* and stores it in IndexedDB. Turning on quick send costs one passkey prompt,
  which authorises the backend-prepared `add_signer`. After that, transfers ≤ `NEXT_PUBLIC_SESSION_KEY_MAX_AMOUNT` sign silently until the TTL ends.
- **Smart-account auth signing** ([`lib/stellar/smartAccount.ts`](lib/stellar/smartAccount.ts)):
  1. Simulate in recording mode.
  2. Sign each address-credential auth entry through `authorizeEntry` with a `{ signatureScVal }` callback.
  3. Re-simulate in enforcing mode, so `__check_auth` is in the footprint.
  4. `assembleTransaction`.
  5. Hand the XDR to the relay for a sponsored fee bump.
- **Calculator.** Debounced quotes, rate-lock countdown, the expired-rate state, a fee breakdown and the payout method (bank / cash pickup).
- **Recipient form.** Corridor-specific validation: MX CLABE (18 digits), BR PIX, AR CBU/CVU (22), EU IBAN. Inline errors keep what the user entered.
- **Review & authorize.** Passkey prompt, or the quick-send session key for small amounts. Funding comes from the partner (SEP-24) or the wallet balance.
- **SEP-24 modal** ([`components/Sep24Modal.tsx`](components/Sep24Modal.tsx)):
  - Sandboxed iframe, gated by an origin allowlist.
  - Popup fallback for anchors that block framing.
  - Completion is detected through the SEP-24 `postMessage` callback, with backend polling as a fallback.
  - Also used on `/wallet` for standalone deposits and withdrawals.
- **Live tracker.** An SSE stream (`/transfers/:id/events`) with an automatic polling fallback. Stages are
  *Payment received → Converted → Settling on Stellar → Delivered*, plus a Stellar Expert link once the transaction is on-chain.
- **Demo mode.** With `NEXT_PUBLIC_DEMO_MODE=true` the backend is mocked, but **passkey ceremonies and signature conversion
  are real**, so you can click through every flow locally without contracts or a relay.

## 🗂 Project structure

```
app/
  page.tsx                    01 Welcome & passkey onboarding
  (app)/                      Authenticated shell (sidebar ≥1024px, bottom tabs on mobile)
    dashboard/ activity/ recipients/ wallet/ settings/
  send/                       02 calculator → recipient/ (03) → review/ (04 + 05 SEP-24)
  transfers/[id]/             06 live tracker
  help/ legal/
components/
  ui/                         Button, Card, Field, StatusPill, Avatar, Icons
  layout/                     AppShell, FlowHeader, Logo, RequireAuth
  providers/                  AuthProvider (session), TransferDraftProvider (multi-step state)
  Sep24Modal.tsx  TransferTracker.tsx  CurrencyAmountInput.tsx  FeeBreakdown.tsx  ActivityList.tsx
hooks/
  usePasskey.ts               register / login / signPayload (DER → low-S r||s)
  useSessionKey.ts            Ed25519 quick-send key lifecycle
  useSendTransfer.ts          picks signer, builds & signs SAC transfer, hands to relay
  useQuote.ts  useTransferStatus.ts
lib/
  config.ts                   typed env config + assertConfig()
  api/                        backend client, types, demo mock
  stellar/
    webauthn.ts               DER parsing, low-S, base64url, P-256 key extraction
    signatures.ts             Signature::WebAuthn / Signature::Ed25519 ScVal encoders
    smartAccount.ts           simulate → authorizeEntry → re-simulate → assemble
    sessionKeys.ts            non-extractable WebCrypto Ed25519 in IndexedDB
    assets.ts                 stablecoins, corridors, 7-decimal i128 conversion
    network.ts                RPC + explorer helpers
test/                         vitest: DER/low-S against Node crypto, ScVal encoding, amounts
```

## ⚙️ Environment setup

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` or `mainnet`. Selects the passphrase and default RPC / explorer. |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Soroban RPC. Defaults to SDF testnet; **required on mainnet**. |
| `NEXT_PUBLIC_STELLAR_EXPLORER_URL` | Optional explorer override. |
| `NEXT_PUBLIC_ACCOUNT_CONTRACT_ID` | Smart-account (passkey wallet) contract / factory reference. Each user's deployed account address comes back from the backend at signup. |
| `NEXT_PUBLIC_SUBSIDY_CONTRACT_ID` | Fee-subsidy / paymaster contract. |
| `NEXT_PUBLIC_USDC_CONTRACT_ID` · `_EURC_` · `_ARST_` · `_BRLA_` | Stellar Asset Contract addresses for each stablecoin. |
| `NEXT_PUBLIC_WEBAUTHN_RP_ID` | WebAuthn relying-party ID. Must be the registrable domain of the HTTPS origin, e.g. `remitpulse.app`. |
| `NEXT_PUBLIC_WEBAUTHN_RP_NAME` | Name shown in the OS passkey sheet. |
| `NEXT_PUBLIC_APP_ORIGIN` | HTTPS origin the backend must accept in `clientDataJSON.origin`. |
| `NEXT_PUBLIC_BACKEND_URL` | Relay / backend: paymaster fee bumps, session-key issuance, quotes, SEP-24 proxy. Also added to the CSP `connect-src`. |
| `NEXT_PUBLIC_SEP24_ALLOWED_ORIGINS` | Comma-separated anchor origins allowed in the SEP-24 iframe (`frame-src` + runtime allowlist). |
| `NEXT_PUBLIC_SESSION_KEY_MAX_AMOUNT` | Highest transfer amount that may use the session key. |
| `NEXT_PUBLIC_SESSION_KEY_TTL_MINUTES` | Session-key lifetime. |
| `NEXT_PUBLIC_DEMO_MODE` | `true` mocks the backend. Must be `false` in production. |

### HTTPS & RP ID

WebAuthn only runs in a secure context. `http://localhost` qualifies, so `npm run dev` works with
`NEXT_PUBLIC_WEBAUTHN_RP_ID=localhost`. To test on a phone or under a custom hostname:

```bash
npm run dev:https          # next dev --experimental-https (self-signed cert)
```

Set `NEXT_PUBLIC_WEBAUTHN_RP_ID` to that hostname and `NEXT_PUBLIC_APP_ORIGIN` to the full `https://` origin. In production
the RP ID must equal the registrable domain (or a parent of it) of the page origin, or the browser rejects the ceremony with `SecurityError`.

## 🔗 Contract integration

`__check_auth` on the account contract receives the signature that
[`lib/stellar/signatures.ts`](lib/stellar/signatures.ts) produces. The expected Rust types are:

```rust
#[contracttype] pub enum Signature { WebAuthn(WebAuthnSignature), Ed25519(Ed25519Signature) }
#[contracttype] pub struct WebAuthnSignature {
    pub authenticator_data: Bytes, pub client_data_json: Bytes, pub id: Bytes,
    pub signature: BytesN<64>,          // raw low-S r || s
}
#[contracttype] pub struct Ed25519Signature { pub public_key: BytesN<32>, pub signature: BytesN<64> }
```

The contract should check that `client_data_json.challenge == base64url(signature_payload)`, then call
`secp256r1_verify(pubkey, sha256(authenticator_data || sha256(client_data_json)), signature)`. **If your compiled contract
uses different type names or fields, `signatures.ts` is the only file to change.**

At signup the passkey's public key is sent to the backend as a 65-byte uncompressed SEC1 point (`0x04‖X‖Y`, hex), ready
to store as the account's signer.

### Backend API contract

| Method & path | Purpose |
| --- | --- |
| `POST /auth/register/options` | `PublicKeyCredentialCreationOptionsJSON` (server challenge) |
| `POST /auth/register/verify` | `{ response, publicKeyHex }` → verify, deploy smart account → `Session { token, contractId, credentialId, displayName }` |
| `POST /auth/login/options` · `/auth/login/verify` | Discoverable login → `Session` |
| `GET /quotes?sendAmount&sendCurrency&receiveCurrency` | `Quote` (rate, fees, expiry, `payTo` settlement address) |
| `GET /accounts/:contractId/balance` · `GET /recipients` · `GET /transfers` | Dashboard data |
| `POST /transfers` | `{ quoteId, recipient, funding, signedXdr, signer }`. The relay rebuilds it with its sponsored source, fee-bumps, and submits it immediately (wallet funding) or once SEP-24 funding completes. Returns `{ transferId, sep24? }` |
| `GET /transfers/:id` · `GET /transfers/:id/events` (SSE, cookie auth) | `TransferStatus` |
| `POST /sep24/interactive` · `GET /sep24/transactions/:id` | Anchor proxy (backend handles SEP-10/SEP-45 auth for the contract account) |
| `POST /session-keys` → `{ xdr }` · `POST /session-keys/confirm` | Session-key issuance: unsigned `add_signer`, then the passkey-signed XDR for submission |

Partner-funded transfers are signed with a longer auth expiry (`AUTH_TTL_LEDGERS.deferred`, about 1 hour), so the relay can
hold them until the anchor confirms the deposit. Only one passkey prompt is needed.

## 🧑‍💻 Local development

```bash
npm install
cp .env.example .env.local      # NEXT_PUBLIC_DEMO_MODE=true works out of the box
npm run dev                     # http://localhost:3000
```

```bash
npm test                        # vitest: signature conversion & encoding
npm run typecheck
```

## 🚀 Production build

```bash
NEXT_PUBLIC_DEMO_MODE=false npm run build    # env is inlined at build time: set real values first
npm start                                    # or deploy .next to any Node host / Vercel
```

Production checklist:

- [ ] Serve over HTTPS on the domain matching `NEXT_PUBLIC_WEBAUTHN_RP_ID`.
- [ ] `NEXT_PUBLIC_DEMO_MODE=false`, and every contract ID and the backend URL set (`assertConfig()` lists any that are missing).
- [ ] `NEXT_PUBLIC_SEP24_ALLOWED_ORIGINS` contains only your anchors' origins.
- [ ] Review the CSP in [`next.config.ts`](next.config.ts) after adding any third-party origins.
- [ ] Replace `/legal` with reviewed copy.

## 🔐 Security notes

- Passkey private keys never leave the authenticator. Session-key private keys are WebCrypto `CryptoKey`s created with
  `extractable: false`, so page scripts can't read them. The on-chain signer scope (cap and expiry) is what actually limits them.
- Every passkey assertion is checked client-side, before submission, to have signed exactly the Soroban auth payload.
- The SEP-24 iframe loads only from allowlisted origins, and `postMessage` events are accepted only from the anchor origin.
- Fees are paid by the relay through a fee bump. Users never hold XLM.

## 📄 License

MIT. See [LICENSE](LICENSE).
