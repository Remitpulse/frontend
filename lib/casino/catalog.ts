export const games = [
  { id: 'dice', title: 'Dice', subtitle: 'Roll under your target', color: '#a483ff', mark: '⚄' },
  {
    id: 'mines',
    title: 'Mines',
    subtitle: 'Uncover gems and cash out',
    color: '#51e5b9',
    mark: '◆',
  },
  {
    id: 'plinko',
    title: 'Plinko',
    subtitle: 'Drop the ball through the pegs',
    color: '#ffd17e',
    mark: '⠿',
  },
  {
    id: 'limbo',
    title: 'Limbo',
    subtitle: 'Set your target multiplier',
    color: '#70cdff',
    mark: '⌁',
  },
  { id: 'coin', title: 'Coin Flip', subtitle: 'Call heads or tails', color: '#f79ad5', mark: '◈' },
  {
    id: 'roulette',
    title: 'European Roulette',
    subtitle: 'Call red, black or zero',
    color: '#ff877e',
    mark: '◎',
  },
  {
    id: 'keno',
    title: 'Keno',
    subtitle: 'Pick five numbers from forty',
    color: '#75d7ff',
    mark: '✦',
  },
  {
    id: 'wheel',
    title: 'Wheel',
    subtitle: 'Spin a twelve-segment wheel',
    color: '#ffce80',
    mark: '◉',
  },
  {
    id: 'baccarat',
    title: 'Baccarat',
    subtitle: 'Back the player, banker or tie',
    color: '#ffaacc',
    mark: '♠',
  },
] as const

export type Game = (typeof games)[number]
export type Entry = {
  id: string
  kind: string
  game: string | null
  amount: string
  created: string
  detail: string
}
export type Round = { stake: string; picks: number[]; payout: string }
export type CasinoState = {
  demo: string
  testnet: string
  entries: Entry[]
  passkey: boolean
  round: Round | null
  paused: boolean
  walletEnabled: boolean
  deposit: { hash: string; amount: string } | null
  withdrawal: { hash: string; amount: string } | null
}

export const gameGroups = {
  Arcade: ['dice', 'mines', 'plinko', 'limbo', 'coin'],
  Tables: ['roulette', 'baccarat'],
  Draws: ['keno', 'wheel'],
} satisfies Record<string, Game['id'][]>
