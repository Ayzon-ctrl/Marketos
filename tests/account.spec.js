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
 * 14. E-Mail-Abschnitt vorhanden, Feld sichtbar und type="email"
 * 15. E-Mail-Validierung: leeres Feld
 * 16. E-Mail-Validierung: ungültiges Format
 * 17. E-Mail-Validierung: identisch mit aktueller E-Mail
 * 18. E-Mail-Erfolgspfad (Auth-PUT gemockt – kein echter E-Mail-Change)
 * 19. Rollen-Erweiterungsabschnitt vorhanden, organizer sieht Button 'Auch als Aussteller nutzen'
 * 20. Cancel-Flow – Bestätigungsdiv öffnen und schließen ohne Aktion
 * 21. Erfolgspfad organizer → both (PATCH gemockt) – Toast, Rollentext, Switcher sichtbar
 * 22. Aussteller sieht Button 'Auch als Veranstalter nutzen' (GET gemockt)
 * 23. role='both' sieht keinen Erweiterungsbutton, aber Info-Text (GET gemockt)
 * 24. role='visitor' wird von /app/account zu /app umgeleitet (Besucher hat keinen Account-Bereich)
 * 25. Mobile: Rollen-Erweiterungsabschnitt sichtbar, kein Horizontal-Overflow
 * 26. Telefonnummer-Feld vorhanden, type="tel", optional
 * 27. Telefonnummer speichern persistiert – inkl. Trim
 * 28. Telefonnummer löschen (leer speichern) möglich
 * 29. Mobile: Konto-Seite mit Telefonnummer-Feld kein Horizontal-Overflow
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
    // Regex statt Glob, damit Query-Parameter (z.B. redirect_to) das Match nicht brechen.
    await page.route(/\/auth\/v1\/user/, async route => {
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

  // --------------------------------------------------------------------------
  // TEST 14: E-Mail-Abschnitt vorhanden, Feld sichtbar und type="email"
  // --------------------------------------------------------------------------

  test('ACCOUNT E-MAIL: E-Mail-Abschnitt vorhanden, Feld sichtbar und type="email"', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Sicherheits-Abschnitt enthält E-Mail-Formular
    const secSection = page.getByTestId('account-security-section')
    await expect(secSection).toBeVisible()
    await expect(page.getByTestId('account-email-form')).toBeVisible()

    // Aktuelle E-Mail-Anzeige vorhanden
    await expect(page.getByTestId('account-current-email-display')).toBeVisible()

    // Eingabefeld vorhanden und type="email"
    const emailInput = page.getByTestId('account-new-email')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('type', 'email')

    // Button vorhanden
    await expect(page.getByTestId('account-email-save')).toBeVisible()
    await expect(page.getByTestId('account-email-save')).toContainText('E-Mail ändern')

    // Hinweistext sichtbar
    await expect(page.getByTestId('account-email-form')).toContainText('Bestätigungsmail')

    // Kein Fehler im Ausgangszustand
    await expect(page.getByTestId('account-email-error')).toHaveCount(0)

    // Passwort-Bereich weiterhin stabil (Regression)
    await expect(page.getByTestId('account-new-password')).toBeVisible()
    await expect(page.getByTestId('account-password-save')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 15: E-Mail-Validierung – leeres Feld
  // --------------------------------------------------------------------------

  test('ACCOUNT E-MAIL: Leeres Feld löst Inline-Fehler aus ohne API-Call', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Direkt auf Speichern klicken ohne Feld zu füllen
    await page.getByTestId('account-email-save').click()

    // Inline-Fehler erscheint
    await expect(page.getByTestId('account-email-error')).toBeVisible()
    await expect(page.getByTestId('account-email-error')).toContainText(/neue E-Mail-Adresse ein/i)

    // Kein Toast (kein API-Call)
    await expect(page.getByTestId('toast-message')).toHaveCount(0)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 16: E-Mail-Validierung – ungültiges Format
  // --------------------------------------------------------------------------

  test('ACCOUNT E-MAIL: Ungültiges E-Mail-Format zeigt Inline-Fehler', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('account-new-email').fill('keine-email')
    await page.getByTestId('account-email-save').click()

    await expect(page.getByTestId('account-email-error')).toBeVisible()
    await expect(page.getByTestId('account-email-error')).toContainText(/gültige E-Mail/i)

    // Kein Toast
    await expect(page.getByTestId('toast-message')).toHaveCount(0)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 17: E-Mail-Validierung – identisch mit aktueller E-Mail
  // --------------------------------------------------------------------------

  test('ACCOUNT E-MAIL: Identische E-Mail zeigt Inline-Fehler', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Aktuelle E-Mail eingeben (aus Credentials)
    await page.getByTestId('account-new-email').fill(credentials.email)
    await page.getByTestId('account-email-save').click()

    await expect(page.getByTestId('account-email-error')).toBeVisible()
    await expect(page.getByTestId('account-email-error')).toContainText(/entspricht der aktuellen/i)

    // Kein Toast
    await expect(page.getByTestId('toast-message')).toHaveCount(0)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 18: E-Mail-Erfolgspfad (Auth-PUT gemockt – kein echter E-Mail-Change)
  // --------------------------------------------------------------------------

  test('ACCOUNT E-MAIL: Erfolgspfad zeigt Toast und leert Feld (Auth-PUT gemockt)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Auth PUT /auth/v1/user abfangen – simuliert erfolgreiche E-Mail-Änderung
    // ohne echten API-Call. Alle anderen Requests laufen normal durch.
    // Regex statt Glob: emailRedirectTo fügt ?redirect_to=... als Query-Param hinzu,
    // das Glob **/auth/v1/user würde diese URL nicht matchen.
    await page.route(/\/auth\/v1\/user/, async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'mock@example.com',
            new_email: 'neue-email@example.com',
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {}
          })
        })
      } else {
        await route.continue()
      }
    })

    // Neue, valide und andere E-Mail eintragen
    await page.getByTestId('account-new-email').fill('neue-email@example.com')
    await page.getByTestId('account-email-save').click()

    // Erfolgs-Toast erscheint
    await expect(page.getByTestId('toast-message')).toContainText(/Bestätigungsmail wurde gesendet/i, { timeout: 8000 })

    // Feld wurde geleert
    await expect(page.getByTestId('account-new-email')).toHaveValue('')

    // Kein Inline-Fehler
    await expect(page.getByTestId('account-email-error')).toHaveCount(0)

    // Passwort-Bereich und Profil-Bereich weiterhin stabil (Regression)
    await expect(page.getByTestId('account-new-password')).toBeVisible()
    await expect(page.getByTestId('account-display-name')).toBeVisible()
    await expect(page.getByTestId('account-logout-button')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 19: Rollen-Erweiterungsabschnitt vorhanden – organizer sieht Button
  // --------------------------------------------------------------------------

  test('ACCOUNT ROLLEN-ERWEITERUNG: Abschnitt vorhanden, organizer sieht Button „Auch als Aussteller nutzen"', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Abschnitt selbst immer sichtbar
    await expect(page.getByTestId('account-role-expand-section')).toBeVisible()

    // Info-Text mit Hinweis auf Aussteller-Ansicht
    await expect(page.getByTestId('account-role-expand-info')).toBeVisible()
    await expect(page.getByTestId('account-role-expand-info')).toContainText(/Aussteller-Ansicht/i)

    // Erweiterungs-Button korrekt beschriftet
    await expect(page.getByTestId('account-role-expand-button')).toBeVisible()
    await expect(page.getByTestId('account-role-expand-button')).toContainText('Auch als Aussteller nutzen')

    // Bestätigungs-Div noch nicht sichtbar
    await expect(page.getByTestId('account-role-expand-confirm')).toHaveCount(0)
    await expect(page.getByTestId('account-role-expand-cancel')).toHaveCount(0)

    // Kein Fehler-Element im Ausgangszustand
    await expect(page.getByTestId('account-role-expand-error')).toHaveCount(0)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 20: Cancel-Flow – Bestätigungsdiv öffnen und abbrechen
  // --------------------------------------------------------------------------

  test('ACCOUNT ROLLEN-ERWEITERUNG: Cancel-Flow öffnet Bestätigungsdiv und bricht korrekt ab', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Erweiterungs-Button klicken → Bestätigungs-Panel erscheint
    await page.getByTestId('account-role-expand-button').click()

    await expect(page.getByTestId('account-role-expand-confirm')).toBeVisible()
    await expect(page.getByTestId('account-role-expand-cancel')).toBeVisible()
    // Erweiterungs-Button selbst verschwindet während des Confirm-Flows
    await expect(page.getByTestId('account-role-expand-button')).toHaveCount(0)

    // Abbrechen → Ursprungszustand wiederhergestellt
    await page.getByTestId('account-role-expand-cancel').click()

    await expect(page.getByTestId('account-role-expand-button')).toBeVisible()
    await expect(page.getByTestId('account-role-expand-confirm')).toHaveCount(0)
    await expect(page.getByTestId('account-role-expand-cancel')).toHaveCount(0)

    // Kein Toast (keine Aktion ausgelöst)
    await expect(page.getByTestId('toast-message')).toHaveCount(0)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 21: Erfolgspfad organizer → both (PATCH gemockt)
  // --------------------------------------------------------------------------

  test('ACCOUNT ROLLEN-ERWEITERUNG: Erfolgspfad setzt role=both, zeigt Toast und Rolle-Switcher (PATCH gemockt)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // PATCH /rest/v1/profiles abfangen – simuliert erfolgreiche Rollen-Erweiterung
    // ohne echten DB-Schreibvorgang. Regex statt Glob (Query-Params wie ?id=eq.UUID
    // würden Glob **/rest/v1/profiles nicht matchen).
    await page.route(/\/rest\/v1\/profiles/, async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-both-id',
            role: 'both',
            display_name: 'TestUser',
            first_name: '',
            last_name: '',
            company_name: '',
            is_admin: false,
            created_at: '2024-01-01T00:00:00Z'
          })
        })
      } else {
        await route.continue()
      }
    })

    // Expand-Button klicken
    await page.getByTestId('account-role-expand-button').click()
    await expect(page.getByTestId('account-role-expand-confirm')).toBeVisible()

    // Bestätigen
    await page.getByTestId('account-role-expand-confirm').click()

    // Erfolgs-Toast erscheint
    await expect(page.getByTestId('toast-message')).toContainText(/Rolle erweitert/i, { timeout: 8000 })

    // Rollenanzeige zeigt 'Veranstalter & Aussteller'
    await expect(page.getByTestId('account-role')).toContainText('Veranstalter & Aussteller')

    // Erweiterungs-Button verschwunden (role ist jetzt 'both')
    await expect(page.getByTestId('account-role-expand-button')).toHaveCount(0)
    await expect(page.getByTestId('account-role-expand-confirm')).toHaveCount(0)

    // Rollen-Switcher erscheint (ProtectedAppShell erkennt role='both'):
    // beide Buttons (role-view-organizer + role-view-exhibitor) werden gerendert;
    // .first() umgeht den strict-mode-Fehler bei mehreren Treffern.
    await expect(
      page.getByTestId('role-view-organizer').or(page.getByTestId('role-view-exhibitor')).first()
    ).toBeVisible({ timeout: 5000 })

    // Profil-Bereich weiterhin stabil (Regression)
    await expect(page.getByTestId('account-display-name')).toBeVisible()
    await expect(page.getByTestId('account-logout-button')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 22: Aussteller sieht Button 'Auch als Veranstalter nutzen' (GET gemockt)
  // --------------------------------------------------------------------------

  test('ACCOUNT ROLLEN-ERWEITERUNG: Aussteller sieht Button „Auch als Veranstalter nutzen" (GET gemockt)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })

    // GET /rest/v1/profiles abfangen – Aussteller-Profil simulieren.
    // page.goto löst einen echten Seitenneuladen aus; ProtectedAppShell liest
    // das Profil beim Mount neu → der gemockte GET wird getroffen.
    // Wichtig: maybeSingle() in postgrest-js v2 setzt KEIN Accept-Object-Header
    // ("No Accept header override — we fetch as a list and enforce cardinality
    // client-side") → die Antwort muss ein Array sein, kein einzelnes Objekt.
    await page.route(/\/rest\/v1\/profiles/, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: '00000000-0000-0000-0000-000000000002',
            role: 'exhibitor',
            display_name: 'Test Aussteller',
            first_name: '',
            last_name: '',
            company_name: '',
            is_admin: false,
            created_at: '2024-01-01T00:00:00Z'
          }])
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Rollenanzeige: 'Aussteller'
    await expect(page.getByTestId('account-role')).toContainText('Aussteller')

    // Erweiterungs-Button korrekt für exhibitor beschriftet
    await expect(page.getByTestId('account-role-expand-button')).toBeVisible()
    await expect(page.getByTestId('account-role-expand-button')).toContainText('Auch als Veranstalter nutzen')

    // Info-Text weist auf Veranstalter-Ansicht hin
    await expect(page.getByTestId('account-role-expand-info')).toContainText(/Veranstalter-Ansicht/i)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 23: role='both' sieht keinen Erweiterungsbutton, aber Info-Text (GET gemockt)
  // --------------------------------------------------------------------------

  test('ACCOUNT ROLLEN-ERWEITERUNG: role=both zeigt keinen Button, aber Info-Text (GET gemockt)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })

    // maybeSingle() → Array-Antwort (siehe TEST 22 Kommentar)
    await page.route(/\/rest\/v1\/profiles/, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: '00000000-0000-0000-0000-000000000003',
            role: 'both',
            display_name: 'Test Both',
            first_name: '',
            last_name: '',
            company_name: '',
            is_admin: false,
            created_at: '2024-01-01T00:00:00Z'
          }])
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Rollenanzeige: 'Veranstalter & Aussteller'
    await expect(page.getByTestId('account-role')).toContainText('Veranstalter & Aussteller')

    // Kein Erweiterungs-Button (role='both', bereits erweitert)
    await expect(page.getByTestId('account-role-expand-button')).toHaveCount(0)

    // Info-Text erklärt verfügbare Funktionen
    await expect(page.getByTestId('account-role-expand-info')).toBeVisible()
    await expect(page.getByTestId('account-role-expand-info')).toContainText(/Veranstalter- und Aussteller-Funktionen/i)

    // Kein Downgrade-Button vorhanden (absichtlich nicht implementiert)
    await expect(page.getByTestId('account-role-expand-section')).toBeVisible()
    await expect(page.locator('[data-testid="account-role-expand-section"] button')).toHaveCount(0)

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 24: role='visitor' wird von /app/account zu /app umgeleitet
  // --------------------------------------------------------------------------

  test('ACCOUNT ROLLEN-ERWEITERUNG: role=visitor wird von /app/account zu /app umgeleitet (GET gemockt)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })

    // maybeSingle() → Array-Antwort (siehe TEST 22 Kommentar).
    // ProtectedAppShell leitet Besucher per useEffect von allen Routen außer
    // /app (overview) und /app/notifications weg. Der account-Bereich ist für
    // Besucher bewusst nicht zugänglich.
    await page.route(/\/rest\/v1\/profiles/, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: '00000000-0000-0000-0000-000000000004',
            role: 'visitor',
            display_name: 'Test Besucher',
            first_name: '',
            last_name: '',
            company_name: '',
            is_admin: false,
            created_at: '2024-01-01T00:00:00Z'
          }])
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/app/account')

    // Besucher werden automatisch zu /app (overview) umgeleitet
    await expect(page).toHaveURL(/\/app$/, { timeout: 10000 })

    // AccountView wird nicht gerendert
    await expect(page.getByTestId('account-view')).toHaveCount(0)

    // App ist weiterhin geladen und authentifiziert
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 5000 })

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 25: Mobile – Rollen-Erweiterungsabschnitt sichtbar, kein Overflow
  // --------------------------------------------------------------------------

  test('ACCOUNT ROLLEN-ERWEITERUNG MOBILE: Abschnitt sichtbar, kein horizontaler Overflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-Test nur auf mobile-chromium.')

    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Rollen-Erweiterungs-Abschnitt auf Mobile sichtbar
    await expect(page.getByTestId('account-role-expand-section')).toBeVisible()

    // Kein horizontaler Scroll (Abschnitt erzeugt keinen Overflow)
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalScroll, 'Kein horizontaler Scroll auf Mobile durch Rollen-Erweiterungs-Abschnitt erwartet').toBeFalsy()
  })

  // --------------------------------------------------------------------------
  // TEST 26: Telefonnummer-Feld vorhanden, type="tel", optional
  // --------------------------------------------------------------------------

  test('ACCOUNT TELEFON: Feld vorhanden, type="tel", kein Pflichtfeld', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Feld vorhanden und korrekt konfiguriert
    const phoneInput = page.getByTestId('account-phone')
    await expect(phoneInput).toBeVisible()
    await expect(phoneInput).toHaveAttribute('type', 'tel')
    await expect(phoneInput).not.toHaveAttribute('required')
    await expect(phoneInput).toHaveAttribute('maxlength', '30')
    await expect(phoneInput).toHaveAttribute('autocomplete', 'tel')

    // Hinweistext sichtbar
    await expect(page.getByTestId('account-profile-section')).toContainText('Optional. Wird nur intern verwendet')

    // Profil-Speichern ohne Phone-Eingabe funktioniert (kein required-Fehler)
    await page.getByTestId('account-save').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Profil gespeichert/i, { timeout: 8000 })

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 27: Telefonnummer speichern persistiert – inkl. Trim
  // --------------------------------------------------------------------------

  test('ACCOUNT TELEFON: Telefonnummer speichern persistiert nach Reload und wird getrimmt', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })

    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Telefonnummer mit Leerzeichen vorne/hinten (Trim-Test)
    const rawPhone = '  +49 170 1234567  '
    const trimmedPhone = '+49 170 1234567'

    await page.getByTestId('account-phone').fill(rawPhone)
    await page.getByTestId('account-save').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Profil gespeichert/i, { timeout: 8000 })

    // Nach Reload: Wert bleibt erhalten (getrimmt)
    await page.reload()
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('account-phone')).toHaveValue(trimmedPhone)

    // Andere Felder weiterhin stabil (Regression)
    await expect(page.getByTestId('account-display-name')).toBeVisible()
    await expect(page.getByTestId('account-save')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 28: Telefonnummer löschen (leer speichern) möglich
  // --------------------------------------------------------------------------

  test('ACCOUNT TELEFON: Telefonnummer löschen (leer speichern) möglich', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Test.')

    const errors = attachConsoleTracking(page)
    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Erst eine Nummer setzen
    await page.getByTestId('account-phone').fill('+49 89 123456')
    await page.getByTestId('account-save').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Profil gespeichert/i, { timeout: 8000 })

    // Warten bis Toast vom ersten Save verschwindet – sonst matcht der zweite
    // toast-Check den ersten Toast statt den vom zweiten Save-Aufruf.
    await page.getByTestId('toast-message').waitFor({ state: 'hidden', timeout: 10000 })

    // Telefonnummer leeren und erneut speichern
    await page.getByTestId('account-phone').fill('')
    await page.getByTestId('account-save').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Profil gespeichert/i, { timeout: 8000 })

    // Nach Reload: Feld leer (NULL → '')
    await page.reload()
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('account-phone')).toHaveValue('')

    // Kein Fehler aufgetreten
    await expect(page.getByTestId('account-phone')).toBeVisible()

    await expectNoConsoleErrors(errors)
  })

  // --------------------------------------------------------------------------
  // TEST 29: Mobile – Telefonnummer-Feld kein horizontaler Overflow
  // --------------------------------------------------------------------------

  test('ACCOUNT TELEFON MOBILE: Telefonnummer-Feld erzeugt keinen horizontalen Overflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile-Test nur auf mobile-chromium.')

    await ensureAuthenticated(page, testInfo.project.name, { skipStyleGuide: true })
    await page.goto('/app/account')
    await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 15000 })

    // Telefonnummer-Feld auf Mobile sichtbar
    await expect(page.getByTestId('account-phone')).toBeVisible()

    // Kein horizontaler Scroll
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalScroll, 'Kein horizontaler Scroll auf Mobile durch Telefonnummer-Feld erwartet').toBeFalsy()
  })
})
