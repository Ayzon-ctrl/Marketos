import { test, expect } from '@playwright/test'
import {
  attachConsoleTracking,
  ensureAuthenticated,
  expectNoConsoleErrors
} from './helpers/workflow'

test.describe.serial('MarketOS Billing', () => {
  test('BILLING: /app/billing ist erreichbar und macht keine Stripe-Calls', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Billing-Vorbereitung wird bewusst auf Desktop geprüft.')

    const errors = attachConsoleTracking(page)
    const stripeRequests = []

    page.on('request', request => {
      if (/stripe/i.test(request.url())) {
        stripeRequests.push(request.url())
      }
    })

    await ensureAuthenticated(page, testInfo.project.name)
    await page.goto('/app/billing')

    await expect(page.getByTestId('billing-view')).toBeVisible()
    await expect(page.getByTestId('billing-current-plan')).toContainText(/Kostenloser Zugang|Kostenlos|Testphase|Starter|Pro/i)
    await expect(page.getByTestId('billing-plan-starter-button')).toContainText(/Demnächst verfügbar/i)
    await expect(page.getByTestId('billing-plan-pro-button')).toContainText(/Demnächst verfügbar/i)

    await expectNoConsoleErrors(errors)
    expect(stripeRequests, `Unerwartete Stripe-Requests gefunden:\n${stripeRequests.join('\n')}`).toEqual([])
  })
})
