import { test, expect } from '@playwright/test'
import {
  attachConsoleTracking,
  ensureAuthenticated,
  expectNoConsoleErrors
} from './helpers/workflow'

test.describe('MarketOS Role Switch', () => {
  test('DESKTOP ROLE SWITCH: Veranstalter und Aussteller wechseln stabil ohne weißen Screen', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Rollenwechsel wird hier gezielt auf Desktop geprüft.')

    const errors = attachConsoleTracking(page)

    await ensureAuthenticated(page, testInfo.project.name)
    await expect(page.getByTestId('app-authenticated')).toBeVisible()
    await expect(page.getByTestId('overview-focus-card')).toBeVisible()

    await page.getByTestId('role-view-exhibitor').click()

    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Aussteller Dashboard/i)
    await expect(page.getByTestId('exhibitor-summary-hero')).toBeVisible()

    if (await page.getByTestId('exhibitor-empty-state').count()) {
      await expect(page.getByTestId('exhibitor-empty-state')).toContainText(
        /Noch kein Ausstellerprofil vorhanden|keine Ausstellerdaten hinterlegt/i
      )
    }

    await expect(page.getByRole('heading', { name: /Veranstalter Dashboard/i })).toHaveCount(0)

    await page.getByTestId('role-view-organizer').click()

    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Veranstalter Dashboard/i)
    await expect(page.getByTestId('overview-focus-card')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })
})
