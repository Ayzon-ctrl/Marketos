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

  test('MOBILE MEHR-MENU: Gruppen sind strukturiert, kein Analytics fuer Nicht-Admins und kein Horizontal-Overflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Dieser Test ist nur fuer Mobile gedacht.')
    test.setTimeout(60000)

    const errors = attachConsoleTracking(page)

    await ensureAuthenticated(page, 'mobile-organizer-only', { role: 'organizer', skipStyleGuide: true })
    await page.goto('/app')

    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible()
    await expect(page.getByTestId('mobile-nav-more')).toBeVisible()
    await page.getByTestId('mobile-nav-more').click()

    const menu = page.getByTestId('mobile-more-menu')
    await expect(menu).toBeVisible()
    await expect(page.getByTestId('mobile-more-group-communication')).toContainText('Kommunikation')
    await expect(page.getByTestId('mobile-more-group-organization')).toContainText('Organisation')
    await expect(page.getByTestId('mobile-more-group-profile-tools')).toContainText('Profil & Tools')
    await expect(page.getByTestId('mobile-more-group-account-view')).toContainText('Konto')
    await expect(page.getByTestId('mobile-more-group-account-view')).not.toContainText('Konto & Ansicht')

    await expect(page.getByTestId('mobile-more-notifications')).toBeVisible()
    await expect(page.getByTestId('mobile-more-messages')).toBeVisible()
    await expect(page.getByTestId('mobile-more-billing')).toBeVisible()
    await expect(page.getByTestId('mobile-more-templates')).toBeVisible()
    await expect(page.getByTestId('mobile-more-reviews')).toBeVisible()
    await expect(page.getByTestId('mobile-more-contracts')).toBeVisible()
    await expect(page.getByTestId('mobile-more-vendor-profile')).toBeVisible()
    await expect(page.getByTestId('mobile-open-style-guide')).toBeVisible()
    await expect(page.getByTestId('mobile-role-view-organizer')).toHaveCount(0)
    await expect(page.getByTestId('mobile-role-view-exhibitor')).toHaveCount(0)
    await expect(page.getByTestId('mobile-logout-button')).toBeVisible()
    await expect(menu).not.toContainText('Besucher')

    await expect(page.getByTestId('mobile-more-group-admin')).toHaveCount(0)
    await expect(page.getByTestId('mobile-more-analytics')).toHaveCount(0)

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalScroll, 'Kein horizontaler Scroll auf Mobile erwartet').toBeFalsy()

    if (await page.getByTestId('style-guide-modal').count()) {
      await page.getByTestId('style-guide-save').click()
      await expect(page.getByTestId('style-guide-modal')).toHaveCount(0)
      await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible()
    }

    await page.getByTestId('mobile-nav-more').click()
    await expect(menu).toHaveCount(0)
    await expect(page.getByTestId('mobile-nav-events')).toBeVisible()
    await expect(page.getByTestId('mobile-nav-overview')).toBeVisible()
    await expectNoConsoleErrors(errors)
  })

  test('MOBILE ROLLENWECHSEL: Rolle both sieht beide Umschalter im Mehr-Menü', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Dieser Test ist nur fuer Mobile gedacht.')
    test.setTimeout(60000)

    const errors = attachConsoleTracking(page)

    await ensureAuthenticated(page, 'mobile-both-role', { role: 'both', skipStyleGuide: true })
    await page.goto('/app')

    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible()
    await page.getByTestId('mobile-nav-more').click()

    const menu = page.getByTestId('mobile-more-menu')
    await expect(menu).toBeVisible()
    await expect(page.getByTestId('mobile-more-group-account-view')).toContainText('Konto & Ansicht')
    await expect(page.getByTestId('mobile-role-view-organizer')).toBeVisible()
    await expect(page.getByTestId('mobile-role-view-exhibitor')).toBeVisible()

    if (await page.getByTestId('style-guide-modal').count()) {
      await page.getByTestId('style-guide-save').click()
      await expect(page.getByTestId('style-guide-modal')).toHaveCount(0)
      await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible()
      if ((await menu.count()) === 0) {
        await page.getByTestId('mobile-nav-more').click()
      }
      await expect(menu).toBeVisible()
      await expect(page.getByTestId('mobile-role-view-organizer')).toBeVisible()
      await expect(page.getByTestId('mobile-role-view-exhibitor')).toBeVisible()
    }

    await page.getByTestId('mobile-role-view-exhibitor').click()
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Aussteller Dashboard/i)

    await page.getByTestId('mobile-nav-more').click()
    await expect(page.getByTestId('mobile-role-view-organizer')).toBeVisible()
    await page.getByTestId('mobile-role-view-organizer').click()
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Veranstalter Dashboard/i)

    await expectNoConsoleErrors(errors)
  })
})
