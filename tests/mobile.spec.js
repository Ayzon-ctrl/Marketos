import { test, expect } from '@playwright/test'
import {
  addDaysBerlin,
  attachConsoleTracking,
  buildTestEventTitle,
  cleanupOwnedTestData,
  ensureAuthenticated,
  expectNoConsoleErrors,
  openEvents,
  resetUserEvents,
  selectCity
} from './helpers/workflow'

test.describe.serial('MarketOS Mobile', () => {
  test('MOBILE ANSICHT: Bottom Navigation sichtbar und Event erstellen funktioniert auf iPhone 13', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Dieser Test ist nur für Mobile gedacht.')
    test.setTimeout(60000)

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const mobileEventTitle = buildTestEventTitle('MobileEvent')
    const futureEventDate = addDaysBerlin(7)

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await expect(page.getByTestId('mobile-nav-overview')).toBeVisible()
      await expect(page.getByTestId('mobile-nav-events')).toBeVisible()
      await expect(page.getByTestId('sidebar')).not.toBeVisible()

      await openEvents(page, true)
      await page.getByTestId('event-title').fill(mobileEventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('save-event').click()

      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)
      await expect(page.getByTestId('event-list-card')).toContainText(mobileEventTitle)
      await page.getByTestId('event-card').filter({ hasText: mobileEventTitle }).first().getByTestId('open-event-detail').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()
      await expect(page.getByTestId('event-detail-title')).toContainText(mobileEventTitle)
      await expect(page.getByTestId('event-detail-participants')).toBeVisible()

      await page.reload()
      await expect(page.getByTestId('mobile-nav-events')).toBeVisible()
      await openEvents(page, true)
      await expect(page.getByTestId('event-list-card')).toContainText(mobileEventTitle)
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [mobileEventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })
})
