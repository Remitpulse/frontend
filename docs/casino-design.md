# RemitPulse Stellar Arcade visual architecture

The previous RemitPulse homepage offered credential enrollment and remittances, with blue-and-mint accents and a narrow financial workflow. The arcade homepage starts with game discovery and a clear XLM balance. Payment and security tasks use quieter surfaces and the same account identity.

## Concepts considered

| Concept | Art direction | Tradeoff |
| --- | --- | --- |
| Champagne observatory | Near-black surfaces, editorial serif headlines, gold metal and axial composition | Strong luxury identity, subdued arcade cues |
| Mint terminal | Crisp typography, subdued navy and teal, dense instrumentation | Financial clarity, less cinematic range |
| Violet orbital arcade | Dark plum, luminous violet, polished orbital materials and distinct colors for each game | Clear game identities and room for cinematic imagery, with subdued surfaces for payment and accounting |

The violet orbital arcade gives the lobby a recognizable hero and lets the game artwork carry most of the color. The wallet, operator report and history rely on typography and spacing to foreground exact XLM amounts.

## System

- **Palette.** Obsidian `#0B0A13`, rail `#11101C`, elevated surfaces `#171526`, line `#2B273E`, primary text `#F9F7FF`, muted text `#B6AEC9`, action violet `#B295FF`, and Testnet mint `#61E5BD`.
- **Typography.** System sans with a tight display headline, clear text hierarchy and tabular numbers for the balance. Currency quantities preserve up to seven decimals. Every balance and action identifies its XLM context.
- **Grid.** Desktop navigation rail and five-column lobby. Tablet uses three cards per row. Small phones use two cards and safe-area-aware bottom navigation. Dialogs use a stacked play area on narrow screens.
- **Surfaces.** Cards use thin borders and restrained elevation. The hero combines original orbital artwork and an adaptive contrast gradient. Game covers share the same lighting and material direction.
- **Motion and access.** Entrance and game motion use Motion for React. Native dialogs manage keyboard focus and Escape. Controls use visible focus outlines, short labels and live result feedback. System reduced-motion settings suppress gameplay transforms.
- **Trust.** Always label the simulated balance. Keep Testnet funds and simulated credits visually and operationally distinct. Explain server draws and rounding. Players can pause demo wagering and recover accounts using passkeys.

## Homepage and interactions

Navigation leads to the lobby, activity, wallet and play controls. The hero action brings focus to the lobby. Search filters the originals immediately. Slots and Live Games have honest unavailable states. The five game cards open dedicated game interfaces and the wallet panel reports approval and settlement stages. Activity shows the two balances, passkey controls and the ledger.
