import { test as base, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// DEMO BACKEND: balances, quotes, funding and delivery are sample data.
// REAL BROWSER: Chromium's virtual CTAP2 authenticator performs the WebAuthn
// ceremonies; application signature conversion and WebCrypto/IndexedDB are real.
const test = base.extend({
  page: async ({ page, context }, runFixture) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      // Fail closed: this suite must never contact a relay, anchor or blockchain.
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
        ? route.continue()
        : route.abort('blockedbyclient')
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })
    await runFixture(page)
    expect(pageErrors).toEqual([])
    await cdp.detach()
  },
})

async function register(page: Page) {
  await page.goto('/')
  await expect(page.getByText(/Demo mode/)).toBeVisible()
  await page.getByRole('button', { name: 'Create account with passkey' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function reviewTransfer(page: Page, amount?: string) {
  await page.goto('/send')
  if (amount) await page.getByLabel('You send', { exact: true }).fill(amount)
  await expect(page.getByRole('button', { name: 'Continue to recipient' })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue to recipient' }).click()
  await expect(page).toHaveURL(/\/send\/recipient$/)
  await page.getByRole('button', { name: 'Review transfer' }).click()
  await expect(page.getByText('Enter their first name.')).toBeVisible()
  await page.getByLabel('First name', { exact: true }).fill('Test')
  await page.getByLabel('Last name', { exact: true }).fill('Recipient')
  await page.getByLabel(/CLABE/).fill('012345678901234567')
  await page.getByRole('button', { name: 'Review transfer' }).click()
  await expect(page).toHaveURL(/\/send\/review$/)
  await expect(page.getByText('Test Recipient', { exact: true })).toBeVisible()
}

test('protected journeys redirect signed-out visitors', async ({ page }) => {
  for (const path of ['/dashboard', '/send', '/wallet']) {
    await page.goto(path)
    await expect(page).toHaveURL('http://localhost:3000/')
    await expect(page.getByRole('button', { name: 'Log in with passkey' })).toBeVisible()
  }
})

test('passkey signup, reload, logout and discoverable login [demo backend]', async ({ page }) => {
  await register(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL('http://localhost:3000/')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rp-session'))).toBeNull()
  await page.getByRole('button', { name: 'Log in with passkey' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('recipient validation, review reload and passkey-authorized wallet transfer [demo settlement]', async ({
  page,
}) => {
  await register(page)
  await reviewTransfer(page)
  await page.reload()
  await expect(page).toHaveURL(/\/send\/review$/)
  await expect(page.getByText('Test Recipient', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: /Pay from wallet balance/ }).check()
  await page.getByRole('button', { name: 'Confirm with passkey' }).click()
  await expect(page).toHaveURL(/\/transfers\/tr_/)
  await expect(page.getByRole('list', { name: 'Transfer progress' })).toBeVisible()
  await page.clock.install()
  await page.clock.fastForward(30_000)
  await expect(page.getByRole('heading', { name: 'Delivered to Test.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Delivered to Test.' })).toBeVisible()
})

test('partner portal completes simulated funding [demo anchor and settlement]', async ({
  page,
}) => {
  await register(page)
  await reviewTransfer(page)
  await page.getByRole('button', { name: 'Confirm with passkey' }).click()
  const portal = page.getByRole('dialog', { name: 'Secure partner portal' })
  await expect(portal).toBeVisible()
  await expect(portal.getByText(/Demo content shown/)).toBeVisible()
  await portal.getByRole('button', { name: 'Continue with partner' }).click()
  await expect(page).toHaveURL(/\/transfers\/tr_/)
  await expect(page.getByRole('list', { name: 'Transfer progress' })).toBeVisible()
})

test('quick send signs a small transfer and local disable reaches another tab [demo registration]', async ({
  page,
  context,
}) => {
  await register(page)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Turn on quick send' }).click()
  await expect(page.getByRole('button', { name: 'Turn off on this device' })).toBeVisible()
  const keyState = () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('remitpulse', 1)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        return await new Promise<boolean | null>((resolve, reject) => {
          const request = db.transaction('session-keys').objectStore('session-keys').get('active')
          request.onsuccess = () => resolve(request.result?.privateKey.extractable ?? null)
          request.onerror = () => reject(request.error)
        })
      } finally {
        db.close()
      }
    })
  await expect.poll(keyState).toBe(false)
  await reviewTransfer(page, '10')
  await page.getByRole('radio', { name: /Pay from wallet balance/ }).check()
  await expect(page.getByText(/session key approves it/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & send' }).click()
  await expect(page).toHaveURL(/\/transfers\/tr_/)
  await page.goto('/settings')
  const otherTab = await context.newPage()
  await otherTab.goto('/settings')
  await expect(otherTab.getByRole('button', { name: 'Turn off on this device' })).toBeVisible()
  await page.getByRole('button', { name: 'Turn off on this device' }).click()
  await expect(page.getByRole('button', { name: 'Turn on quick send' })).toBeVisible()
  await expect.poll(keyState).toBeNull()
  await expect(otherTab.getByRole('button', { name: 'Turn on quick send' })).toBeVisible()
  await otherTab.close()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Turn on quick send' })).toBeVisible()
})

test('onboarding, dashboard, send and review pass automated WCAG A/AA checks [demo backend]', async ({
  page,
}) => {
  await page.goto('/')
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([])
  await register(page)
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([])
  await page.goto('/send')
  await expect(page.getByRole('button', { name: 'Continue to recipient' })).toBeEnabled()
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([])
  await reviewTransfer(page)
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([])
})
