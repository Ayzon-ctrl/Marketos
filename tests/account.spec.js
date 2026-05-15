/**
 * ACCOUNT: Konto-Seite /app/account
 *
 * Prüft:
 *  1. Konto-Seite ist über Sidebar-Button erreichbar
 *  2. Sidebar: "Konto & Sitzung"-Label, Button aktiv-State
 *  3. Konto-Seite ist über Mobile Mehr-Menü erreichbar
 *  4. Profilfelder werden angezeigt und Rolle ist read-only
 *  5. Profil speichern persistiert Felder und aktualisiert Begrüßung
 *  6. is_admin wird durch Profil-Update nicht verändert
 *  7. Logout leitet zu /login weiter
 *  8. Mobile: Kein Horizontal-Overflow
 *  9. Sicherheits-Abschnitt vorhanden, Passwortfelder sichtbar
 * 10. Passwort-Validierung: leere Felder
 * 11. Passwort-Validierung: zu kurz
 * 12. Passwort-Validierung: Mismatch
 * 13. Passwort-Erfolgspfad (Auth-Anfrage gemockt – kein echter Passwort-Change)
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

  // --------------------------------------------------------------------------
  // TEST 9: Sicherheits-Abschnitt vorhanden, Passwortfelder sichtbar
  // --------------------------------------------------------------------------

  test('ACCOUNT SICHERHEIT: Sicherheits-Abschnitt vorhanden und Passwortfelder sichtbar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Abschnitt sichtbar
    await expect(page.getByTestId('account-security-section')).toBeVisible()

    // Passwortfelder vorhanden
    await expect(page.getByTestId('account-new-password')).toBeVisible()
    await expect(page.getByTestId('account-confirm-password')).toBeVisible()
    await expect(page.getByTestId('account-password-save')).toBeVisible()
    await expect(page.getByTestId('account-password-save')).toContainText('Passwort ändern')

    // Felder sind vom Typ password (nicht text)
    await expect(page.getByTestId('account-new-password')).toHaveAttribute('type', 'password')
    await expect(page.getByTestId('account-confirm-password')).toHaveAttribute('type', 'password')

    // Kein Fehler sichtbar im Ausgangszustand
    await expect(page.getByTestId('account-password-error')).toHaveCount(0)

    // Profil-Bereich weiterhin stabil
    await expect(page.getByTestId('account-display-name')).toBeVisible()
    await expect(page.getByTestId('account-logout-button')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 10: Passwort-Validierung – leere Felder
  // --------------------------------------------------------------------------

  test('ACCOUNT SICHERHEIT: Leere Felder lösen Inline-Fehler aus ohne API-Call', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Direkt auf Speichern klicken ohne Felder zu füllen
    await page.getByTestId('account-password-save').click()

    // Inline-Fehler erscheint
    await expect(page.getByTestId('account-password-error')).toBeVisible()
    await expect(page.getByTestId('account-password-error')).toContainText(/ausfüllen/i)

    // Toast zeigt keine Erfolgs-/Fehlermeldung (wurde nicht abgeschickt)
    await expect(page.getByTestId('toast-message')).toHaveCount(0)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 11: Passwort-Validierung – zu kurz
  // --------------------------------------------------------------------------

  test('ACCOUNT SICHERHEIT: Zu kurzes Passwort zeigt Inline-Fehler', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('account-new-password').fill('abc')
    await page.getByTestId('account-confirm-password').fill('abc')
    await page.getByTestId('account-password-save').click()

    await expect(page.getByTestId('account-password-error')).toBeVisible()
    await expect(page.getByTestId('account-password-error')).toContainText(/mindestens 6/i)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 12: Passwort-Validierung – Mismatch
  // --------------------------------------------------------------------------

  test('ACCOUNT SICHERHEIT: Nicht übereinstimmende Passwörter zeigen Inline-Fehler', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('account-new-password').fill('Passwort123')
    await page.getByTestId('account-confirm-password').fill('AnderesPW99')
    await page.getByTestId('account-password-save').click()

    await expect(page.getByTestId('account-password-error')).toBeVisible()
    await expect(page.getByTestId('account-password-error')).toContainText(/stimmen nicht überein/i)

    // Kein API-Call ausgelöst → kein Toast
    await expect(page.getByTestId('toast-message')).toHaveCount(0)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 13: Passwort-Erfolgspfad (Auth-PUT gemockt – kein echter Passwort-Change)
  // --------------------------------------------------------------------------

  test('ACCOUNT SICHERHEIT: Erfolgspfad zeigt Toast und leert Felder (Auth-PUT gemockt)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Auth PUT /auth/v1/user abfangen – simuliert erfolgreiche Passwortänderung
    // ohne echten API-Call. Alle anderen Requests laufen normal durch.
    await page.route('**/auth/v1/user', async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'mock@example.com',
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {}
          })
        })
      } else {
        await route.continue()
      }
    })

    // Valide Eingaben – lang genug, stimmen überein
    await page.getByTestId('account-new-password').fill('NeuesPasswort99')
    await page.getByTestId('account-confirm-password').fill('NeuesPasswort99')
    await page.getByTestId('account-password-save').click()

    // Erfolgs-Toast erscheint
    await expect(page.getByTestId('toast-message')).toContainText(/Passwort wurde geändert/i, { timeout: 8000 })

    // Felder wurden geleert
    await expect(page.getByTestId('account-new-password')).toHaveValue('')
    await expect(page.getByTestId('account-confirm-password')).toHaveValue('')

    // Kein Inline-Fehler
    await expect(page.getByTestId('account-password-error')).toHaveCount(0)

    // Profil-Bereich unverändert stabil (Regression)
    await expect(page.getByTestId('account-display-name')).toBeVisible()
    await expect(page.getByTestId('account-logout-button')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })
})
