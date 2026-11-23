import { expect, test } from '@playwright/test'

test('originals settle in XLM and search matches the game catalog', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '1000.00 XLM demo balance' })).toBeVisible()
  const search = page.getByRole('searchbox', { name: 'Search games' })
  await search.fill('limbo')
  await expect(page.locator('.game-card')).toHaveCount(1)
  await search.clear()
  for (const [game, action] of [
    ['Dice', 'Roll dice'],
    ['Plinko', 'Drop ball'],
    ['Limbo', 'Launch'],
    ['Coin Flip', 'Flip coin'],
  ]) {
    await page.getByRole('button', { name: new RegExp('^' + game + ' ') }).click()
    await page.getByRole('button', { name: action }).click()
    await expect(page.getByText(/^Payout .* XLM$/)).toBeVisible()
    await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: /^Mines / }).click()
  await page.getByRole('button', { name: 'Start round' }).click()
  await page.getByRole('button', { name: 'Tile 1', exact: true }).click()
  await expect(page.getByText(/Gem found\.|Mine hit\./)).toBeVisible()
})

test('can recover the same demo ledger using an origin-bound passkey', async ({
  context,
  page,
}) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      automaticPresenceSimulation: true,
      isUserVerified: true,
    },
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '1000.00 XLM demo balance' })).toBeVisible()
  await page.getByRole('button', { name: /^Plinko / }).click()
  await page.getByRole('button', { name: 'Drop ball' }).click()
  await expect(page.getByText(/^Payout .* XLM$/)).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: 'Add passkey' }).click()
  await expect(page.getByText('Passkey saved for this account.')).toBeVisible()

  await context.clearCookies()
  await page.reload()
  await expect(page.getByRole('button', { name: '1000.00 XLM demo balance' })).toBeVisible()
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page.getByText('Signed in with a passkey.')).toBeVisible()
  await expect(page.locator('.history li').filter({ hasText: 'Plinko' })).toHaveCount(2)
})
