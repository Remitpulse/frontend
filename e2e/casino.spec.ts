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

test('favorites and new game filters lead to a server-settled Keno round', async ({ page }) => {
  await page.goto('/')
  const lobby = page.getByRole('region', { name: 'Game lobby' })
  await lobby.getByRole('button', { name: 'Tables' }).click()
  await expect(lobby.locator('.game-card')).toHaveCount(2)
  await lobby.getByRole('button', { name: 'Favorite Baccarat' }).click()
  await lobby.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(lobby.locator('.game-card')).toHaveCount(1)
  await lobby.getByRole('button', { name: 'Draws', exact: true }).click()
  await lobby.getByRole('button', { name: /^Keno / }).click()
  const game = page.getByRole('dialog', { name: 'Keno' })
  await expect(game.getByRole('button', { name: 'Draw numbers' })).toBeDisabled()
  for (let number = 1; number <= 5; number++) {
    await game.getByRole('button', { name: String(number), exact: true }).click()
  }
  await game.getByRole('button', { name: 'Draw numbers' }).click()
  await expect(game.locator('[data-drawn=true]')).toHaveCount(10)
  await expect(game.getByText(/^Payout .* XLM$/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Recently played' })).toContainText('Keno')
})

test('places a simulated XLM sports ticket from the quoted odds', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sports', exact: true }).click()
  await page.getByRole('button', { name: 'Basketball', exact: true }).click()
  const fixture = page.locator('.fixture').filter({ hasText: 'Metro Comets' })
  await fixture.getByRole('button', { name: /^Metro Comets / }).click()
  const slip = page.getByRole('region', { name: 'Bet slip' })
  await slip.getByRole('textbox').fill('0.1234567')
  await expect(slip.getByText('Potential return')).toBeVisible()
  await slip.getByRole('button', { name: 'Place demo bet' }).click()
  await expect(page.getByText('Demo ticket accepted.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your tickets' })).toContainText(
    '0.1234567 XLM stake',
  )
})
