# RemitPulse Stellar Arcade

This repo contains the Next.js and TypeScript frontend for the RemitPulse Testnet casino. Dice, Mines, Plinko, Limbo and Coin Flip use simulated XLM. Freighter connects to native XLM payments on Stellar Testnet. The activity and operator views use XLM throughout.

## Local development

1. Run the sibling [casino backend](https://github.com/Remitpulse/backend) with Node.js 24 at `http://127.0.0.1:4010`.
2. In this checkout, run `npm ci` and `npm run dev`. Visit `http://localhost:3000` so the default passkey origin matches.
3. Optionally configure a funded Stellar Testnet treasury in the backend. Use Freighter on Stellar Testnet and fund a test wallet through [Stellar Lab](https://lab.stellar.org/).
4. Load `/operator` with the token configured in the backend.

The frontend uses a same-origin API relay. Set `CASINO_BACKEND_URL` if the backend is on another private origin. For a production build, run `npm run build` and `npm start`. This milestone permits simulated wagers and Testnet payments only. See [visual architecture](docs/casino-design.md).
