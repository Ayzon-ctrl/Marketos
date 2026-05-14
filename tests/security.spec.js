import { test, expect } from '@playwright/test'
import {
  attachConsoleTracking,
  buildTestEventTitle,
  buildTestVendorName,
  cleanupOwnedTestData,
  createEventRecord,
  ensureAuthenticated,
  ensureVendorProfile,
  expectNoConsoleErrors,
  getAnonClient,
  getOwnVendorProfile,
  getTestCategory,
  resetUserEvents,
  verifyNoPublicTestEvents
} from './helpers/workflow'

const protectedPaths = ['/app', '/app/events', '/app/billing', '/app/vendor-profile', '/app/notifications']
const deepLinks = ['/app/events/some-id', '/app/markets/some-id', '/app/vendor-profile']

test.describe.serial('MarketOS Security', () => {
  test('SECURITY: geschützte Routen bleiben ohne Login gesperrt, auch mit manipuliertem Storage', async ({ page }) => {
    const errors = attachConsoleTracking(page)

    for (const path of [...protectedPaths, ...deepLinks]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByTestId('login-form')).toBeVisible()
    }

    await page.addInitScript(() => {
      window.localStorage.setItem('marketos-role-view', 'organizer')
      window.localStorage.setItem('selectedRole', 'organizer')
      window.localStorage.setItem('fake-auth', 'true')
      window.sessionStorage.setItem('selectedRole', 'organizer')
      window.sessionStorage.setItem('fake-auth', 'true')
    })

    await page.goto('/app/events')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId('app-authenticated')).toHaveCount(0)
    await expectNoConsoleErrors(errors)
  })

  test('SECURITY: Logout, Back-Button und gelöschte Tokens geben keinen geschützten Zugriff frei', async ({ page }, testInfo) => {
    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name)
    await page.goto('/app/events')
    await expect(page.getByTestId('app-authenticated')).toBeVisible()

    if (testInfo.project.name === 'mobile-chromium') {
      await page.getByTestId('mobile-logout-button').click()
    } else {
      await page.getByTestId('logout-button').click()
    }

    await expect(page).toHaveURL(/\/login$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId('app-authenticated')).toHaveCount(0)

    await ensureAuthenticated(page, testInfo.project.name)
    await page.goto('/app')
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('sb-')) window.localStorage.removeItem(key)
      }
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith('sb-')) window.sessionStorage.removeItem(key)
      }
    })
    await page.reload()
    await expect(page).toHaveURL(/\/login$/)
    await expectNoConsoleErrors(errors)
  })

  test('CLEANUP: Keine öffentlichen PW_E2E_-Events sichtbar nach vollständigem Cleanup', async () => {
    const leaked = await verifyNoPublicTestEvents()
    expect(
      leaked.map(e => e.title),
      `${leaked.length} öffentliche Test-Events gefunden – Cleanup hat nicht funktioniert:\n${leaked.map(e => e.title).join('\n')}`
    ).toHaveLength(0)
  })

  test('SECURITY: private Events und private Händlerprofile bleiben aus Public Routes und anon Queries draußen', async ({ page }, testInfo) => {
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const privateEventTitle = buildTestEventTitle('PrivateEvent')
    const privateVendorName = buildTestVendorName('PrivateVendor')
    const privateVendorCategory = getTestCategory(`${testInfo.project.name}-private`)

    try {
      await resetUserEvents(credentials)
      const privateEvent = await createEventRecord(credentials, {
        title: privateEventTitle,
        public_visible: false
      })
      await ensureVendorProfile(credentials, {
        business_name: privateVendorName,
        category: privateVendorCategory,
        description: `${privateVendorName} ist ein nicht öffentliches Testprofil.`,
        public_visible: false
      })
      const privateVendor = await getOwnVendorProfile(credentials)

      const anonClient = getAnonClient()
      const [tasksResult, notificationsResult, billingResult] = await Promise.all([
        anonClient.from('tasks').select('id').limit(1),
        anonClient.from('notifications').select('id').limit(1),
        anonClient.from('subscriptions').select('id').limit(1)
      ])

      expect(tasksResult.data || []).toHaveLength(0)
      expect(notificationsResult.data || []).toHaveLength(0)
      expect(billingResult.data || []).toHaveLength(0)

      await page.context().clearCookies()
      await page.goto('/login')

      await page.goto('/markets')
      await expect(page.getByTestId('public-market-card').filter({ hasText: privateEventTitle })).toHaveCount(0)
      await page.goto(`/markets/${privateEvent.id}`)
      await expect(page.getByTestId('public-page-empty')).toBeVisible()

      await page.goto('/vendors')
      await expect(page.getByTestId('public-vendor-card').filter({ hasText: privateVendorName })).toHaveCount(0)
      await page.goto(`/vendors/${privateVendor.id}`)
      await expect(page.getByTestId('public-page-empty')).toBeVisible()
    } finally {
      await cleanupOwnedTestData(credentials, {
        eventTitles: [privateEventTitle],
        vendorNames: [privateVendorName]
      })
    }
  })
})
