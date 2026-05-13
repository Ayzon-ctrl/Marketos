import { test, expect } from '@playwright/test'
import {
  attachConsoleTracking,
  ensureAuthenticated,
  expectNoConsoleErrors,
  isStyleGuideSchemaReady,
  resetUserEvents,
  setStyleGuideSeen
} from './helpers/workflow'

test.describe.serial('MarketOS Auth', () => {
  test('LOGIN: Öffentliche Startseite zeigt Login oben rechts, Login-Seite und Passwort-Toggle funktionieren', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Dieser Login-Flow wird bewusst nur auf Desktop geprüft.')

    await page.goto('/')
    await expect(page.getByTestId('public-home-page')).toBeVisible()
    await expect(page.getByTestId('public-nav-login')).toBeVisible()
    await page.getByTestId('public-nav-login').click()

    await expect(page.getByTestId('login-form')).toBeVisible()
    const errors = attachConsoleTracking(page)
    await expect(page.getByTestId('login-email')).toBeVisible()
    await expect(page.getByTestId('login-password')).toBeVisible()
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password')
    await page.getByTestId('toggle-password').click()
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'text')
    await page.getByTestId('toggle-password').click()
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: /Noch kein Konto\? Registrieren/i }).click()
    await expect(page.getByTestId('register-role')).toBeVisible()
    await expect(page.getByTestId('register-role')).toHaveValue('organizer')
    await expect(page.getByTestId('register-role')).not.toContainText('Besucher')
    await expect(page.getByTestId('register-role')).toContainText('Veranstalter')
    await expect(page.getByTestId('register-role')).toContainText('Aussteller')
    await expect(page.getByTestId('register-role')).toContainText('Beides')
    await page.getByRole('button', { name: /Schon Konto\? Einloggen/i }).click()
    await expect(page.getByTestId('login-submit')).toBeVisible()

    const credentials = await ensureAuthenticated(page, testInfo.project.name, {
      requireExplicitLogin: true,
      skipStyleGuide: true
    })
    await resetUserEvents(credentials)
    await page.reload()
    await expect(page.getByTestId('app-authenticated')).toBeVisible()
    await expect(page.getByTestId('dashboard-topbar')).toBeVisible()

    const styleGuideReady = await isStyleGuideSchemaReady(credentials)
    if (styleGuideReady) {
      await setStyleGuideSeen(credentials, false)
      await page.reload()
      await expect(page.getByTestId('style-guide-modal')).toBeVisible()
      await page.getByTestId('theme-sidebar-forest').click()
      await page.getByTestId('theme-background-rose').click()
      await page.getByTestId('style-guide-save').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Style Guide gespeichert/i)
      await expect(page.getByTestId('style-guide-modal')).toBeHidden()
      await expect(page.getByTestId('app-authenticated')).toHaveAttribute('data-sidebar-theme', 'forest')
      await expect(page.getByTestId('app-authenticated')).toHaveAttribute('data-background-theme', 'rose')
      await page.reload()
      await expect(page.getByTestId('style-guide-modal')).toHaveCount(0)
      await expect(page.getByTestId('app-authenticated')).toHaveAttribute('data-sidebar-theme', 'forest')
      await expect(page.getByTestId('app-authenticated')).toHaveAttribute('data-background-theme', 'rose')
      await page.getByTestId('sidebar-more-toggle').click()
      await page.getByTestId('sidebar-open-style-guide').click()
      await expect(page.getByTestId('style-guide-modal')).toBeVisible()
      await page.getByTestId('style-guide-close').click()
      await expect(page.getByTestId('style-guide-modal')).toHaveCount(0)
    }

    await expectNoConsoleErrors(errors)
  })
})
