/**
 * ACCOUNT: Konto-Seite /app/account
 *
 * Prüft:
 * 1. Konto-Seite ist über Sidebar-Button erreichbar
 * 2. Konto-Seite ist über Mobile Mehr-Menü erreichbar
 * 3. Profilfelder werden angezeigt
 * 4. Profil speichern persistiert display_name, first_name, last_name, company_name
 * 5. Nach Speichern: Begrüßung übernimmt neuen Anzeigenamen
 * 6. Rolle wird nur angezeigt – kein Bearbeitungsfeld vorhanden
 * 7. is_admin wird nicht im Update-Payload verändert (Sicherheitscheck)
 * 8. Logout auf Konto-Seite führt zurück zum Login
 * 9. Kein Horizontal-Overflow auf Mobile
 */

import { test, expect } from '@playwright/test'
import {
  attachConsoleTracking,
  ensureAuthenticated,
  expectNoConsoleErrors,
  getAuthedClient,
  resetUserEvents
} from './helpers/workflow'

test.describe.serial('MarketOS Account', () => {

  // --------------------------------------------------------------------------
  // TEST 1: Konto-Seite über Sidebar erreichbar
  // --------------------------------------------------------------------------

  test('ACCOUNT: Konto-Seite ist über Sidebar-Button erreichbar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Sidebar-Test nur auf Desktop.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('sidebar-nav-account').click()

    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/app\/account/)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 2: Sidebar Konto-Bereich Struktur und Active-State
  // --------------------------------------------------------------------------

  test('ACCOUNT: Sidebar zeigt "Konto & Sitzung", Button klar erkennbar und active auf /app/account', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Sidebar-Test nur auf Desktop.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })

    // Bereich sichtbar
    await expect(page.getByTestId('sidebar-user-info')).toBeVisible()
    await expect(page.getByTestId('sidebar-account-section-label')).toContainText('Konto & Sitzung')

    // Button klar sichtbar und klickbar
    const accountBtn = page.getByTestId('sidebar-nav-account')
    await expect(accountBtn).toBeVisible()
    await expect(accountBtn).toContainText('Konto verwalten')
    // Noch nicht aktiv (wir sind auf /app)
    await expect(accountBtn).not.toHaveClass(/\bactive\b/)

    // Logout sichtbar
    await expect(page.getByTestId('logout-button')).toBeVisible()

    // Klick → /app/account, Button wird active
    await accountBtn.click()
    await expect(page).toHaveURL(/\/app\/account/, { timeout: 8000 })
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 8000 })
    await expect(accountBtn).toHaveClass(/\bactive\b/)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 3: Konto-Seite über Mobile Mehr-Menü erreichbar
  // --------------------------------------------------------------------------

  test('ACCOUNT: Konto-Seite ist über Mobile Mehr-Menü erreichbar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-Test nur auf mobile-chromium.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('mobile-nav-more').click()
    await expect(page.getByTestId('mobile-more-menu')).toBeVisible()
    await expect(page.getByTestId('mobile-more-account')).toBeVisible()
    await page.getByTestId('mobile-more-account').click()

    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 10000 })

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 4: Profilfelder werden angezeigt
  // --------------------------------------------------------------------------

  test('ACCOUNT: Profilfelder werden angezeigt und Rolle ist read-only', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Formular-Test nur auf Desktop.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Alle Profilfelder sichtbar
    await expect(page.getByTestId('account-display-name')).toBeVisible()
    await expect(page.getByTestId('account-first-name')).toBeVisible()
    await expect(page.getByTestId('account-last-name')).toBeVisible()
    await expect(page.getByTestId('account-company-name')).toBeVisible()
    await expect(page.getByTestId('account-save')).toBeVisible()

    // Konto-Info: E-Mail und Rolle sichtbar, keine Formularfelder dafür
    await expect(page.getByTestId('account-email')).toBeVisible()
    await expect(page.getByTestId('account-role')).toBeVisible()

    // Rolle ist kein input-Element – nur Anzeigetext
    await expect(page.locator('[data-testid="account-role"] input')).toHaveCount(0)
    await expect(page.locator('[data-testid="account-role"] select')).toHaveCount(0)

    // Logout-Button vorhanden
    await expect(page.getByTestId('account-logout-button')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 5: Profil speichern persistiert Felder + Begrüßung übernimmt Namen
  // --------------------------------------------------------------------------

  test('ACCOUNT: Profil speichern persistiert Felder und aktualisiert Begrüßung', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Formular-Test nur auf Desktop.')

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await resetUserEvents(credentials)

    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Neue Werte eintragen
    const uniqueSuffix = String(Date.now()).slice(-6)
    const newDisplayName = `TestName${uniqueSuffix}`
    const newFirstName = `VorTest${uniqueSuffix}`
    const newLastName = `NachTest${uniqueSuffix}`
    const newCompany = `Firma Test ${uniqueSuffix}`

    await page.getByTestId('account-display-name').fill(newDisplayName)
    await page.getByTestId('account-first-name').fill(newFirstName)
    await page.getByTestId('account-last-name').fill(newLastName)
    await page.getByTestId('account-company-name').fill(newCompany)

    await page.getByTestId('account-save').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Profil gespeichert/i)

    // Begrüßung muss neuen Namen zeigen (ohne Reload)
    await expect(page.getByTestId('dashboard-topbar')).toContainText(newDisplayName)

    // Nach Reload: Felder persistent
    await page.reload()
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('account-display-name')).toHaveValue(newDisplayName)
    await expect(page.getByTestId('account-first-name')).toHaveValue(newFirstName)
    await expect(page.getByTestId('account-last-name')).toHaveValue(newLastName)
    await expect(page.getByTestId('account-company-name')).toHaveValue(newCompany)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 6: is_admin bleibt unverändert nach Profil-Update
  // --------------------------------------------------------------------------

  test('ACCOUNT: is_admin wird durch den Profil-Update nicht verändert', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'DB-Prüfung nur auf Desktop.')

    const credentials = await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    const client = await getAuthedClient(credentials)
    const { data: { user } } = await client.auth.getUser()

    // is_admin-Wert vor dem Update lesen
    const { data: profileBefore } = await client
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isAdminBefore = profileBefore?.is_admin ?? false

    // Konto-Seite öffnen und Profil speichern (kein is_admin im Formular)
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('account-display-name').fill('SicherheitsTest')
    await page.getByTestId('account-save').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Profil gespeichert/i)

    // is_admin nach Update: muss identisch sein
    const { data: profileAfter } = await client
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    expect(
      profileAfter?.is_admin ?? false,
      'is_admin darf durch den Profil-Update nicht verändert worden sein'
    ).toBe(isAdminBefore)
  })

  // --------------------------------------------------------------------------
  // TEST 7: Logout auf Konto-Seite leitet zu /login weiter
  // --------------------------------------------------------------------------

  test('ACCOUNT: Logout-Button auf Konto-Seite leitet zu /login weiter', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Logout-Test.')

    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('account-logout-button').click()

    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 })
    await expect(page.getByTestId('login-form')).toBeVisible()
    await expect(page.getByTestId('app-authenticated')).toHaveCount(0)
  })

  // --------------------------------------------------------------------------
  // TEST 8: Mobile – kein Horizontal-Overflow auf Account-Seite
  // --------------------------------------------------------------------------

  test('ACCOUNT MOBILE: Kein horizontaler Overflow auf der Konto-Seite', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-Test nur auf mobile-chromium.')

    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalScroll, 'Kein horizontaler Scroll auf Mobile erwartet').toBeFalsy()
  })
})
