export type DiceProof = {
  version: 1
  commitment: string
  serverSeed: string
  clientSeed: string
  roll: number
  target: number
  stake: string
  payout: string
}

export async function verifyDiceProof(proof: DiceProof) {
  const isSeed = (value: string) => /^[a-f0-9]{64}$/.test(value)
  if (
    proof.version !== 1 ||
    !isSeed(proof.serverSeed) ||
    !isSeed(proof.clientSeed) ||
    !Number.isInteger(proof.target) ||
    proof.target < 2 ||
    proof.target > 98 ||
    !/^[1-9]\d{0,9}$/.test(proof.stake) ||
    BigInt(proof.stake) > 1_000_000_000n
  )
    return false

  const seed = Uint8Array.from(proof.serverSeed.match(/../g)!, (byte) => Number.parseInt(byte, 16))
  const digest = await crypto.subtle.digest('SHA-256', seed)
  const commitment = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  if (commitment !== proof.commitment) return false

  const key = await crypto.subtle.importKey('raw', seed, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const encoder = new TextEncoder()
  for (let counter = 0; ; counter++) {
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`remitpulse:dice:v1:${proof.clientSeed}:${counter}`),
    )
    const draw = new DataView(signature).getUint32(0)
    if (draw >= 4_294_960_000) continue
    const roll = draw % 10_000
    const payout =
      roll < proof.target * 100 ? (BigInt(proof.stake) * 99n) / BigInt(proof.target) : 0n
    return roll === proof.roll && payout.toString() === proof.payout
  }
}
