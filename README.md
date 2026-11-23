# RemitPulse Stellar Arcade

The Next.js frontend serves nine casino games and a simulated sportsbook. Every stake and return is shown in XLM. The wallet connects to Stellar Testnet through Freighter and displays its balance separately from demo credits.

## Start locally

Use Node.js 24. Start the sibling [backend](https://github.com/Remitpulse/backend/tree/stellar-casino-milestone) on port 4010, then run:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Set `CASINO_BACKEND_URL` for a different backend address. Set `CASINO_PUBLIC_ORIGIN` on both services to the exact public HTTPS origin when deploying behind a proxy. Use the same origin for passkey enrollment and sign-in.

## Games

| Game | How to play |
| --- | --- |
| Mines | Set 1–24 mines, reveal gems and cash out. The table shows the current return and the next gem’s potential return. |
| Dice | Set a threshold and see four tumbling dice show the exact server roll from 00.00 to 99.99. The track shows the cutoff and win chance. |
| Plinko | Watch the eight-step drop land in the server-selected multiplier slot. |
| Limbo | Set a target and compare it with the final multiplier. |
| Coin Flip | Choose heads or tails and watch the settled face turn into view. |
| European Roulette | Choose red, black or zero and watch the wheel settle on the actual pocket. |
| Keno | Choose five numbers and watch ten drawn numbers appear in order. |
| Wheel | Spin a twelve-segment wheel with six blank segments. |
| Baccarat | Back Player, Banker or Tie and see both hands dealt from the server result. |

Game tables show wager presets, exact XLM returns and the most recent settled outcomes available in your activity ledger. The sportsbook offers fictional football, basketball and tennis fixtures with quoted odds and a single-selection ticket per fixture.

## Verify and deploy

Run `npm run lint`, `npm run typecheck` and `npm run build`. For Playwright, start the backend, build the frontend, run `npx playwright install chromium`, then run `npm run test:e2e`. The [backend deployment instructions](https://github.com/Remitpulse/backend/tree/stellar-casino-milestone#deploy-both-services) cover the two-service Compose stack.

The deployed milestone uses simulated wagers and Stellar Testnet wallet payments. The operator can enable native Testnet transfers by configuring a funded Testnet treasury on the backend. See the [visual architecture](docs/casino-design.md).

### Resume a Testnet transfer

Open **Wallet** and connect Freighter on Stellar Testnet. The on-chain
balance belongs to the connected address. The credited Testnet balance is
available for withdrawal to the session's linked wallet.

When a deposit was signed before an interruption, **Resume signed deposit
from this browser** retries that exact envelope. Under **Recent Testnet
transfers**, **Check deposit** checks the selected transaction by its hash.
For a reserved withdrawal, **Check pending withdrawal** checks the hash shown
in the wallet. A definitive failed withdrawal returns its reserve and remains
visible in history.

### Verify a Dice round

Before a wager, expand **Pre-wager Dice proof** and save the commitment for
the next roll. The table can verify the receipt against the commitment it
received before play. Later, open **Activity → Dice proof** to compare a
saved commitment or download the receipt for offline verification.

### Review an expired transfer

If Horizon has no receipt and the signed envelope has expired, the wallet
shows that the transaction needs operator review. Use the transaction hash
from the wallet or Activity when investigating. A reserved withdrawal
remains in the pending queue until there is a recorded outcome.
