/**
 * APP-ENTRY: Öffentliche Site → Dashboard → kein Crash
 *
 * Prüft drei Einstiegspunkte:
 * 1. Öffentliche Startseite → Dashboard-Button klicken → /app
 * 2. Direkt /app aufrufen (nach Login)
 * 3. /app neu laden (F5-Reload)
 *
 * In allen drei Fällen muss gelten:
 * - Kein PageError (inkl. "Cannot read properties of undefined")
 * - Keine weißen Bildschirme (app-authenticated ist sichtbar)
 * - Sidebar ist sichtbar
 * - Kein Runtime-Crash (keine console errors mit Ausnahme bekannter Optional-API-Fehler)
 */

import { test, expect } from '@playwright/test'
import { fmtDate, fmtDateRange, getGreetingForHour, getSetupDate, getTeardownDate } from '../src/lib/eventUtils'
import {
  attachConsoleTracking,
  ensureAuthenticated,
  expectNoConsoleErrors
} from './helpers/workflow'

test.describe.serial('MarketOS App Entry', () => {

  test('APP-ENTRY: Öffentliche Startseite → Dashboard-Button → /app ohne Crash', async ({ page }) => {
    const errors = attachConsoleTracking(page)
    const pageErrors = []

    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    // Einloggen, dann auf die öffentliche Startseite navigieren
    await ensureAuthenticated(page, 'app-entry-organizer', { role: 'organizer', skipStyleGuide: true })
    await page.goto('/')

    // Public-Shell soll sichtbar sein
    await expect(page.getByTestId('public-shell')).toBeVisible()

    // Dashboard-Button klicken (nur sichtbar wenn eingeloggt)
    const dashboardBtn = page.getByTestId('public-nav-dashboard')
    await expect(dashboardBtn).toBeVisible()
    await dashboardBtn.click()

    // App soll ohne Crash laden
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('sidebar')).toBeVisible()

    // Kein PageError
    expect(
      pageErrors,
      `PageError beim Navigieren von / nach /app:\n${pageErrors.join('\n')}`
    ).toHaveLength(0)

    await expectNoConsoleErrors(errors)
  })

  test('APP-ENTRY: Direkt /app aufrufen ohne Crash', async ({ page }) => {
    const errors = attachConsoleTracking(page)
    const pageErrors = []

    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    await ensureAuthenticated(page, test.info().project.name, { skipStyleGuide: true })
    await page.goto('/app')

    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Veranstalter Dashboard/i)
    await expect(page.getByTestId('role-view-organizer')).toHaveCount(0)
    await expect(page.getByTestId('role-view-exhibitor')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Besucher', exact: true })).toHaveCount(0)

    expect(
      pageErrors,
      `PageError beim direkten Aufruf von /app:\n${pageErrors.join('\n')}`
    ).toHaveLength(0)

    await expectNoConsoleErrors(errors)
  })

  test('APP-ENTRY: /app neu laden (Reload) ohne Crash', async ({ page }) => {
    const errors = attachConsoleTracking(page)
    const pageErrors = []

    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    await ensureAuthenticated(page, 'app-entry-organizer', { role: 'organizer', skipStyleGuide: true })
    await page.goto('/app')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })

    // Seite neu laden
    await page.reload()
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('sidebar')).toBeVisible()

    expect(
      pageErrors,
      `PageError nach Reload von /app:\n${pageErrors.join('\n')}`
    ).toHaveLength(0)

    await expectNoConsoleErrors(errors)
  })

  test('APP-ENTRY: Begruessungslogik nutzt die gewuenschten Uhrzeitgrenzen', async () => {
    expect(getGreetingForHour(5)).toBe('Guten Morgen')
    expect(getGreetingForHour(10)).toBe('Guten Morgen')
    expect(getGreetingForHour(11)).toBe('Guten Tag')
    expect(getGreetingForHour(17)).toBe('Guten Tag')
    expect(getGreetingForHour(18)).toBe('Guten Abend')
    expect(getGreetingForHour(4)).toBe('Guten Abend')
  })

  test('APP-ENTRY: Datumsformat ist immer zweistellig', async () => {
    expect(fmtDate('2026-05-01')).toBe('01.05.2026')
    expect(fmtDate('2026-03-09')).toBe('09.03.2026')
    expect(fmtDate('2026-05-13')).toBe('13.05.2026')
  })

  test('APP-ENTRY: Organizer ignoriert exhibitor-localStorage und sieht keinen Rollenumschalter', async ({ page }) => {
    const errors = attachConsoleTracking(page)

    await page.addInitScript(() => {
      window.localStorage.setItem('marketos-role-view', 'exhibitor')
    })

    await ensureAuthenticated(page, 'role-organizer-only', { role: 'organizer', skipStyleGuide: true })
    await page.goto('/app')

    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Veranstalter Dashboard/i)
    await expect(page.getByTestId('role-view-organizer')).toHaveCount(0)
    await expect(page.getByTestId('role-view-exhibitor')).toHaveCount(0)
    expect(await page.evaluate(() => window.localStorage.getItem('marketos-role-view'))).toBe('organizer')

    await expectNoConsoleErrors(errors)
  })

  test('APP-ENTRY: Exhibitor ignoriert organizer-localStorage und landet in der Ausstelleransicht', async ({ page }) => {
    const errors = attachConsoleTracking(page)

    await page.addInitScript(() => {
      window.localStorage.setItem('marketos-role-view', 'organizer')
    })

    await ensureAuthenticated(page, 'role-exhibitor-only', { role: 'exhibitor', skipStyleGuide: true })
    await page.goto('/app')

    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Aussteller Dashboard/i)
    await expect(page.getByTestId('role-view-organizer')).toHaveCount(0)
    await expect(page.getByTestId('role-view-exhibitor')).toHaveCount(0)
    const hasSummaryHero = await page.getByTestId('exhibitor-summary-hero').count()
    const hasEmptyState = await page.getByTestId('exhibitor-empty-state').count()
    expect(hasSummaryHero > 0 || hasEmptyState > 0).toBeTruthy()
    expect(await page.evaluate(() => window.localStorage.getItem('marketos-role-view'))).toBe('exhibitor')

    await expectNoConsoleErrors(errors)
  })

  test('APP-ENTRY: fmtDateRange, getSetupDate und getTeardownDate arbeiten korrekt', async () => {
    // fmtDateRange
    expect(fmtDateRange(null, null)).toBe('Ohne Datum')
    expect(fmtDateRange('2026-06-15', null)).toBe('15.06.2026')
    expect(fmtDateRange('2026-06-15', '2026-06-15')).toBe('15.06.2026')
    expect(fmtDateRange('2026-06-15', '2026-06-17')).toBe('15.06.2026 – 17.06.2026')

    // getSetupDate
    expect(getSetupDate('2026-06-15', 0)).toBe('2026-06-15')
    expect(getSetupDate('2026-06-15', -1)).toBe('2026-06-14')
    expect(getSetupDate('2026-06-15', -2)).toBe('2026-06-13')

    // getTeardownDate
    expect(getTeardownDate('2026-06-15', null, 0)).toBe('2026-06-15')
    expect(getTeardownDate('2026-06-15', null, 1)).toBe('2026-06-16')
    expect(getTeardownDate('2026-06-15', '2026-06-17', 0)).toBe('2026-06-17')
    expect(getTeardownDate('2026-06-15', '2026-06-17', 1)).toBe('2026-06-18')
  })

  test('APP-ENTRY: Rolle both sieht beide Umschalter und kann zwischen den Fachansichten wechseln', async ({ page }) => {
    const errors = attachConsoleTracking(page)

    await ensureAuthenticated(page, 'role-both', { role: 'both', skipStyleGuide: true })
    await page.goto('/app')

    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('role-view-organizer')).toBeVisible()
    await expect(page.getByTestId('role-view-exhibitor')).toBeVisible()
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Veranstalter Dashboard/i)
    if (await page.getByTestId('style-guide-modal').count()) {
      await page.getByTestId('style-guide-save').click()
      await expect(page.getByTestId('style-guide-modal')).toHaveCount(0)
    }

    await page.getByTestId('role-view-exhibitor').click()
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Aussteller Dashboard/i)

    await page.getByTestId('role-view-organizer').click()
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Veranstalter Dashboard/i)

    await expectNoConsoleErrors(errors)
  })
})
