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
| Dice | Set a threshold and see the server’s roll on the track. |
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
