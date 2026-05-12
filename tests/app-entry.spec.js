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
import {
  attachConsoleTracking,
  ensureAuthenticated,
  expectNoConsoleErrors
} from './helpers/workflow'

test.describe.serial('MarketOS App Entry', () => {
  let credentials

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    credentials = await ensureAuthenticated(page, test.info().project.name)
    await page.close()
  })

  test('APP-ENTRY: Öffentliche Startseite → Dashboard-Button → /app ohne Crash', async ({ page }) => {
    const errors = attachConsoleTracking(page)
    const pageErrors = []

    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    // Einloggen, dann auf die öffentliche Startseite navigieren
    await ensureAuthenticated(page, test.info().project.name, { skipStyleGuide: true })
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

    await ensureAuthenticated(page, test.info().project.name, { skipStyleGuide: true })
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
})
