/**
 * analytics.dashboard.spec.js
 *
 * Testet das interne Analytics-Dashboard (/app/analytics).
 *
 * Anforderungen:
 * - Nur fuer App-Admins sichtbar (profile.is_admin = true)
 * - Kein Crash, kein PageError
 * - Aggregierte Daten werden angezeigt
 * - Keine verbotenen Felder im DOM (user_id, session_id, entity_id, metadata, route)
 * - Leerzustand funktioniert
 * - Filter aendern die Anzeige
 * - Mobile: kein horizontales Layout-Problem
 * - Nicht-Admins: Analytics nicht sichtbar oder klar abgefangen
 *
 * Testsetup:
 * - Der Test-Account setzt in beforeAll is_admin = true auf seinem eigenen Profil.
 *   Dies ist moeglich, weil die bestehende RLS-Update-Policy auf profiles keine
 *   Column-Level-Einschraenkung fuer is_admin enthaelt (akzeptiertes Trade-off fuer
 *   ein internes Aggregate-Dashboard ohne PII).
 */

import { test, expect } from '@playwright/test'
import {
  attachConsoleTracking,
  ensureAuthenticated,
  expectNoConsoleErrors,
  getAuthedClient,
} from './helpers/workflow'

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Navigiert zur Analytics-Seite und wartet bis ein Terminal-State sichtbar ist.
 *
 * Beachte: analytics-loading erscheint erst NACH dem ProtectedAppShell-Ladevorgang,
 * weil ContentRouter erst gerendert wird wenn loading=false. Die Bedingung wartet
 * daher auf analytics-view ODER analytics-no-access – nicht nur auf das Fehlen
 * von analytics-loading (das vor der ersten Render nicht im DOM ist).
 */
async function openAnalytics(page) {
  await page.goto('/app/analytics')
  await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
  // Warten bis AnalyticsView einen Terminal-State erreicht hat:
  // - analytics-view: Admin, Daten geladen oder leer
  // - analytics-no-access: Nicht-Admin
  await page.waitForFunction(
    () => {
      const view     = document.querySelector('[data-testid="analytics-view"]')
      const noAccess = document.querySelector('[data-testid="analytics-no-access"]')
      const loading  = document.querySelector('[data-testid="analytics-loading"]')
      // Terminal-State: view oder no-access vorhanden UND kein aktiver Loading-Spinner
      return !!(view || noAccess) && !loading
    },
    { timeout: 20000 }
  )
}

/**
 * Wechselt den Environment-Filter auf 'development' und wartet auf Neuladung.
 */
async function switchToDevelopmentEnv(page) {
  const select = page.getByTestId('filter-environment')
  await select.selectOption('development')
  // Kurz warten bis der RPC-Call zurueckkommt
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="analytics-loading"]'),
    { timeout: 10000 }
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.serial('MarketOS Analytics Dashboard', () => {
  let credentials
  let client

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    credentials = await ensureAuthenticated(page, 'analytics-dashboard')
    client = await getAuthedClient(credentials)
    await page.close()

    // Test-Account als Analytics-Admin markieren.
    // get_analytics_summary() und die Analytics-View erfordern profile.is_admin = true.
    // Die bestehende RLS-Policy erlaubt Nutzern, ihr eigenes Profil zu aktualisieren.
    const { data: userData } = await client.auth.getUser()
    const { error: adminError } = await client
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', userData.user.id)
    if (adminError) throw new Error(`is_admin konnte nicht gesetzt werden: ${adminError.message}`)

    // Test-Events schreiben damit die Development-Ansicht Daten hat.
    // Drei unterschiedliche Event-Typen fuer Summary-Berechnung.
    await client.rpc('track_event', {
      p_event_name:   'app_entry',
      p_area:         'dashboard',
      p_role_context: 'organizer',
      p_session_id:   crypto.randomUUID(),
      p_environment:  'development',
    })
    await client.rpc('track_event', {
      p_event_name:   'import_dialog_opened',
      p_area:         'events',
      p_role_context: 'organizer',
      p_session_id:   crypto.randomUUID(),
      p_environment:  'development',
    })
    await client.rpc('track_event', {
      p_event_name:   'import_completed',
      p_area:         'events',
      p_role_context: 'organizer',
      p_session_id:   crypto.randomUUID(),
      p_environment:  'development',
    })
    await client.rpc('track_event', {
      p_event_name:   'event_saved',
      p_area:         'events',
      p_role_context: 'organizer',
      p_session_id:   crypto.randomUUID(),
      p_environment:  'development',
    })
  })

  // -------------------------------------------------------------------------
  // TEST 1: Admin sieht Analytics-Nav-Eintrag im Mehr-Menü
  // -------------------------------------------------------------------------

  test('NAV: Admin sieht Analytics im Mehr-Menü der Sidebar', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })

    // Mehr-Bereich in der Sidebar aufklappen
    const toggleMore = page.getByTestId('sidebar-more-toggle')
    if (await toggleMore.isVisible()) {
      await toggleMore.click()
    }

    // Analytics-Button muss sichtbar sein
    await expect(page.getByTestId('sidebar-more-analytics')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 2: Analytics-View laesst sich oeffnen ohne PageError
  // -------------------------------------------------------------------------

  test('VIEW: /app/analytics oeffnet ohne PageError und ohne Crash', async ({ page }) => {
    const errors = attachConsoleTracking(page)
    const pageErrors = []
    page.on('pageerror', err => pageErrors.push(err.message))

    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)

    // View-Container muss gerendert sein
    await expect(page.getByTestId('analytics-view')).toBeVisible()

    expect(
      pageErrors,
      `PageError beim Oeffnen von /app/analytics:\n${pageErrors.join('\n')}`
    ).toHaveLength(0)

    await expectNoConsoleErrors(errors)
  })

  // -------------------------------------------------------------------------
  // TEST 3: Filter-Leiste ist vorhanden und bedienbar
  // -------------------------------------------------------------------------

  test('FILTER: Alle vier Filter sind sichtbar und haben die richtigen Defaults', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)

    await expect(page.getByTestId('analytics-filters')).toBeVisible()
    await expect(page.getByTestId('filter-days')).toBeVisible()
    await expect(page.getByTestId('filter-role')).toBeVisible()
    await expect(page.getByTestId('filter-area')).toBeVisible()
    await expect(page.getByTestId('filter-environment')).toBeVisible()

    // Default-Werte pruefen
    await expect(page.getByTestId('filter-days')).toHaveValue('30')
    await expect(page.getByTestId('filter-role')).toHaveValue('')
    await expect(page.getByTestId('filter-area')).toHaveValue('')
    await expect(page.getByTestId('filter-environment')).toHaveValue('production')
  })

  // -------------------------------------------------------------------------
  // TEST 4: Development-Daten erscheinen nach Filter-Umschaltung
  // -------------------------------------------------------------------------

  test('DATA: Nach Umschalten auf Development-Umgebung erscheinen Daten', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)

    // Auf Development umschalten (dort haben wir Events geschrieben)
    await switchToDevelopmentEnv(page)

    // Es muss entweder Daten oder den Leerzustand geben – kein Fehler
    const hasSummary = await page.getByTestId('analytics-summary').isVisible()
    const hasEmpty   = await page.getByTestId('analytics-empty').isVisible()
    const hasError   = await page.getByTestId('analytics-error').isVisible()

    expect(hasError, 'Analytics-Fehler darf nicht angezeigt werden').toBeFalsy()
    expect(hasSummary || hasEmpty, 'Entweder Daten oder Leerzustand muss sichtbar sein').toBeTruthy()

    // Da wir im beforeAll Events geschrieben haben, muss Daten vorhanden sein
    await expect(page.getByTestId('analytics-summary')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 5: Summary Cards werden berechnet und angezeigt
  // -------------------------------------------------------------------------

  test('SUMMARY: Summary Cards zeigen berechnete Werte', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)
    await switchToDevelopmentEnv(page)

    await expect(page.getByTestId('analytics-summary')).toBeVisible()

    // Gesamt-Events muss eine Zahl > 0 sein
    const totalText = await page.getByTestId('summary-total').textContent()
    const total = parseInt((totalText || '0').replace(/\./g, '').replace(/,/g, ''), 10)
    expect(total).toBeGreaterThan(0)

    // Aktive Tage muss >= 1 sein
    const daysText = await page.getByTestId('summary-days').textContent()
    const activeDays = parseInt(daysText || '0', 10)
    expect(activeDays).toBeGreaterThanOrEqual(1)

    // Haeufigster Event-Name muss ein nicht-leerer String sein
    const topEvent = await page.getByTestId('summary-top-event').textContent()
    expect(topEvent?.trim().length).toBeGreaterThan(0)
    expect(topEvent?.trim()).not.toBe('–')

    // Aktivster Bereich muss ein nicht-leerer String sein
    const topArea = await page.getByTestId('summary-top-area').textContent()
    expect(topArea?.trim().length).toBeGreaterThan(0)
    expect(topArea?.trim()).not.toBe('–')
  })

  // -------------------------------------------------------------------------
  // TEST 6: Top-Events-Sektion und Bereich-Sektion erscheinen
  // -------------------------------------------------------------------------

  test('SECTIONS: Top-Events- und Bereich-Sektionen sind sichtbar', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)
    await switchToDevelopmentEnv(page)

    await expect(page.getByTestId('top-events-section')).toBeVisible()
    await expect(page.getByTestId('area-breakdown-section')).toBeVisible()
    await expect(page.getByTestId('role-breakdown-section')).toBeVisible()

    // Mindestens eine Bar-Row muss vorhanden sein
    const barRows = page.getByTestId('analytics-bar-row')
    expect(await barRows.count()).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // TEST 7: Import-Conversion wird angezeigt (da wir opened + completed haben)
  // -------------------------------------------------------------------------

  test('IMPORT: Import-Conversion-Karte erscheint wenn opened und completed vorhanden', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)
    await switchToDevelopmentEnv(page)

    await expect(page.getByTestId('summary-import-conversion')).toBeVisible()
    await expect(page.getByTestId('import-conversion-section')).toBeVisible()

    const convText = await page.getByTestId('summary-import-conversion').textContent()
    expect(convText).toMatch(/\d+%/)
  })

  // -------------------------------------------------------------------------
  // TEST 8: Leerzustand erscheint bei nicht-vorhandenem Bereich-Filter
  // -------------------------------------------------------------------------

  test('EMPTY: Leerzustand erscheint wenn kein Datensatz fuer die Filter-Kombination existiert', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)

    // 'stand-pricing' als Bereich: In keinem Test und in keinem App-Code wird
    // jemals ein Event mit area='stand-pricing' + environment='development' geschrieben.
    // Daher ist dieser Filter-Zustand sicher leer – auch ueber mehrere Test-Runs hinweg.
    await page.getByTestId('filter-environment').selectOption('development')
    await page.getByTestId('filter-area').selectOption('stand-pricing')
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="analytics-loading"]'),
      { timeout: 10000 }
    )

    // Kein Fehler-State
    const hasError = await page.getByTestId('analytics-error').isVisible()
    expect(hasError, 'Kein Fehler-Zustand erwartet').toBeFalsy()

    // Leerzustand muss erscheinen
    await expect(
      page.getByTestId('analytics-empty'),
      'Leerzustand muss erscheinen fuer Bereich ohne Tracking-Daten'
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 9: Keine verbotenen Felder im DOM
  // user_id, session_id, entity_id, metadata duerfen nicht im DOM erscheinen
  // -------------------------------------------------------------------------

  test('DATENSCHUTZ: Keine verbotenen Felder im DOM der Analytics-View', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)
    await switchToDevelopmentEnv(page)

    const viewEl = page.getByTestId('analytics-view')
    await expect(viewEl).toBeVisible()

    // DOM-Inhalt der Analytics-View als Text
    const bodyText = await viewEl.innerText()

    // Verbotene Bezeichner duerfen nicht als sichtbarer Text erscheinen
    // (die RPC gibt sie nicht zurueck, daher koennen sie nur durch einen Bug auftauchen)
    expect(bodyText).not.toMatch(/\buser_id\b/)
    expect(bodyText).not.toMatch(/\bsession_id\b/)
    expect(bodyText).not.toMatch(/\bentity_id\b/)

    // UUID-Pattern direkt im sichtbaren Text: kein Datenleck von IDs
    // (event_names, area etc. sind keine UUIDs, daher sicher zu pruefen)
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    expect(bodyText).not.toMatch(uuidPattern)

    // E-Mail-Pattern darf nicht erscheinen
    expect(bodyText).not.toMatch(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  })

  // -------------------------------------------------------------------------
  // TEST 10: Filter-Aenderung aktualisiert Anzeige
  // Zeitraum von 30 auf 7 Tage wechseln – State aendert sich korrekt
  // -------------------------------------------------------------------------

  test('FILTER: Zeitraum-Umschaltung funktioniert ohne Fehler', async ({ page }) => {
    const errors = attachConsoleTracking(page)

    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await openAnalytics(page)

    // Auf 7 Tage wechseln
    await page.getByTestId('filter-days').selectOption('7')
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="analytics-loading"]'),
      { timeout: 10000 }
    )

    // Kein Fehler-State
    await expect(page.getByTestId('analytics-error')).not.toBeVisible()

    // Auf 90 Tage wechseln
    await page.getByTestId('filter-days').selectOption('90')
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="analytics-loading"]'),
      { timeout: 10000 }
    )
    await expect(page.getByTestId('analytics-error')).not.toBeVisible()

    await expectNoConsoleErrors(errors)
  })

  // -------------------------------------------------------------------------
  // TEST 11: Admin sieht Analytics in der Navigation unabhaengig von roleView
  // -------------------------------------------------------------------------

  // Nach T1.6.1 steuert profile.is_admin – nicht roleView – ob der Analytics-
  // Eintrag in der Navigation erscheint. Ein Admin sieht den Button auch dann,
  // wenn er im Exhibitor-Kontext arbeitet.

  test('ACCESS: Admin sieht Analytics im Mehr-Menü auch im Exhibitor-Kontext', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })

    await expect(page.getByTestId('role-view-organizer')).toHaveCount(0)
    await expect(page.getByTestId('role-view-exhibitor')).toHaveCount(0)

    // Mehr-Bereich oeffnen
    const toggleMore = page.getByTestId('sidebar-more-toggle')
    if (await toggleMore.isVisible()) {
      await toggleMore.click()
    }

    // Admin-User: Analytics-Button muss sichtbar sein (is_admin = true, unabhaengig von roleView)
    await expect(
      page.getByTestId('sidebar-more-analytics'),
      'Admin sieht den Analytics-Button, ohne automatisch beide Fachrollen zu erhalten'
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 12: Admin sieht Analytics-Dashboard unabhaengig von roleView
  // -------------------------------------------------------------------------

  // profile.is_admin steuert den Zugriff – roleView hat keinen Einfluss mehr.
  // Auch mit localStorage='exhibitor' muss ein Admin analytics-view sehen.

  test('ACCESS: Admin sieht Analytics-Dashboard unabhaengig vom roleView in localStorage', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })

    // Falschen Altwert in localStorage setzen.
    await page.goto('/app')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    await page.evaluate(() => {
      localStorage.setItem('marketos-role-view', 'exhibitor')
    })

    await page.goto('/app')
    await expect(page.getByTestId('dashboard-topbar')).toContainText(/Veranstalter Dashboard/i)
    expect(await page.evaluate(() => localStorage.getItem('marketos-role-view'))).toBe('organizer')

    // /app/analytics laden – Admin soll trotz exhibitor-localStorage das Dashboard sehen
    await openAnalytics(page)

    // Admin muss analytics-view sehen, nicht analytics-no-access
    await expect(
      page.getByTestId('analytics-view'),
      'Admin muss das Analytics-Dashboard sehen, unabhaengig vom roleView'
    ).toBeVisible()
    await expect(page.getByTestId('analytics-no-access')).not.toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 13: Mobile – kein horizontales Layout-Problem
  // -------------------------------------------------------------------------

  test('MOBILE: Analytics-View bricht auf 390px nicht horizontal aus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    // localStorage auf organizer zuruecksetzen (Test 12 hat exhibitor gesetzt)
    await page.evaluate(() => { localStorage.setItem('marketos-role-view', 'organizer') })
    await page.goto('/app/analytics')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })

    // Development-Env per URL-Parameter geht nicht – wir pruefen nur Layout
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="analytics-loading"]'),
      { timeout: 10000 }
    )

    // Der View-Container darf nicht breiter als das Viewport sein
    const viewEl = page.getByTestId('analytics-view')
    if (await viewEl.isVisible()) {
      const box = await viewEl.boundingBox()
      if (box) {
        expect(box.width).toBeLessThanOrEqual(390 + 2) // 2px Toleranz fuer border-box
      }
    }

    // Kein horizontaler Scroll auf dem Body
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalScroll, 'Kein horizontaler Scroll auf Mobile erwartet').toBeFalsy()
  })

  test('MOBILE: Admin sieht im Mehr-Menue die Admin-Gruppe mit Analytics', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })

    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible()
    await page.getByTestId('mobile-nav-more').click()

    await expect(page.getByTestId('mobile-more-menu')).toBeVisible()
    await expect(page.getByTestId('mobile-more-group-admin')).toContainText('Admin')
    await expect(page.getByTestId('mobile-more-analytics')).toBeVisible()
    await expect(page.getByTestId('mobile-role-view-organizer')).toHaveCount(0)
    await expect(page.getByTestId('mobile-role-view-exhibitor')).toHaveCount(0)
  })

  // -------------------------------------------------------------------------
  // TEST 14: Analytics-View rendert ohne pageerror auch bei leerem State
  // -------------------------------------------------------------------------

  test('VIEW: Kein Crash beim Anzeigen der Production-Ansicht (leer oder mit Daten)', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', err => pageErrors.push(err.message))

    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    // localStorage auf organizer zuruecksetzen (Test 12 hat exhibitor gesetzt).
    // Admin sieht analytics-view ohnehin unabhaengig vom roleView –
    // Reset sichert aber einen sauberen Ausgangszustand fuer den Snapshot.
    await page.evaluate(() => { localStorage.setItem('marketos-role-view', 'organizer') })

    // Oeffnet /app/analytics und wartet auf echten Terminal-State
    await openAnalytics(page)

    // Kein PageError
    expect(
      pageErrors,
      `PageError beim Rendern der Analytics-View:\n${pageErrors.join('\n')}`
    ).toHaveLength(0)

    // analytics-view muss sichtbar sein (organizer + kein Crash)
    await expect(page.getByTestId('analytics-view')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Desktop Mehr-Menü Dropdown (UX1.3)
//
// Testet das neue Dropdown-Verhalten des Desktop-Mehr-Menüs:
// - Open/Close-Toggling per Klick
// - aria-expanded korrekt gesetzt
// - Admin sieht Analytics, Nicht-Admin nicht
// - Direktnavigation zu /app/analytics öffnet Menü automatisch
// - Manuelles Schliessen funktioniert auch wenn More-View aktiv ist
// ---------------------------------------------------------------------------

/**
 * Wartet bis ProtectedAppShell vollständig geladen ist und Sidebar gerendert wurde.
 */
async function waitForShell(page) {
  await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('sidebar')).toBeVisible()
}

test.describe.serial('MarketOS Desktop Mehr-Menü Dropdown', () => {
  // -------------------------------------------------------------------------
  // TEST 15: Mehr-Menü ist auf /app initial geschlossen
  // -------------------------------------------------------------------------

  test('DROPDOWN: Mehr-Menü ist auf /app initial geschlossen (aria-expanded=false)', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app')
    await waitForShell(page)

    const toggle = page.getByTestId('sidebar-more-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // Subnav-Inhalte muessen unsichtbar sein
    await expect(page.getByTestId('sidebar-more-analytics')).not.toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 16: Klick öffnet Menü, aria-expanded wird true
  // -------------------------------------------------------------------------

  test('DROPDOWN: Klick auf Toggle öffnet Menü und setzt aria-expanded=true', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app')
    await waitForShell(page)

    const toggle = page.getByTestId('sidebar-more-toggle')
    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // Subnav muss sichtbar sein
    await expect(page.getByTestId('sidebar-more-panel')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 17: Zweiter Klick schließt Menü, aria-expanded wird false
  // -------------------------------------------------------------------------

  test('DROPDOWN: Zweiter Klick schließt Menü wieder (aria-expanded=false)', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app')
    await waitForShell(page)

    const toggle = page.getByTestId('sidebar-more-toggle')
    // Öffnen
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // Schließen
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('sidebar-more-analytics')).not.toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 18: Admin sieht Analytics-Eintrag nach Öffnen
  // -------------------------------------------------------------------------

  test('DROPDOWN: Admin sieht sidebar-more-analytics nach Öffnen des Menüs', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app')
    await waitForShell(page)

    await page.getByTestId('sidebar-more-toggle').click()
    await expect(page.getByTestId('sidebar-more-analytics')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 19: Nicht-Admin sieht Analytics-Eintrag nicht
  // -------------------------------------------------------------------------

  // Frischer Test-Account 'more-menu-nonadmin' hat is_admin=false (Standard, kein Grant).
  // Kein beforeAll-Grant für diesen Account.

  test('DROPDOWN: Nicht-Admin sieht sidebar-more-analytics nicht', async ({ page }) => {
    await ensureAuthenticated(page, 'more-menu-nonadmin', { skipStyleGuide: true })
    await page.goto('/app')
    await waitForShell(page)

    const toggle = page.getByTestId('sidebar-more-toggle')
    if (await toggle.isVisible()) {
      await toggle.click()
      await page.waitForTimeout(300) // kurz warten bis Subnav gerendert
    }

    await expect(page.getByTestId('sidebar-more-analytics')).not.toBeVisible()
  })

  // -------------------------------------------------------------------------
  // TEST 20: /app/analytics direkt → Menü automatisch offen
  // -------------------------------------------------------------------------

  test('DROPDOWN: /app/analytics direkt aufgerufen → Menü initial offen (aria-expanded=true)', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app/analytics')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    // Warten bis Terminal-State der Analytics-View
    await page.waitForFunction(
      () => {
        const view     = document.querySelector('[data-testid="analytics-view"]')
        const noAccess = document.querySelector('[data-testid="analytics-no-access"]')
        const loading  = document.querySelector('[data-testid="analytics-loading"]')
        return !!(view || noAccess) && !loading
      },
      { timeout: 20000 }
    )

    // Menü muss wegen isMoreViewActive automatisch offen sein
    await expect(page.getByTestId('sidebar-more-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('sidebar-more-analytics')).toBeVisible()
    // Analytics-Button muss als aktiv markiert sein
    await expect(page.getByTestId('sidebar-more-analytics')).toHaveClass(/active/)
  })

  // -------------------------------------------------------------------------
  // TEST 21: Menü schließbar auch wenn /app/analytics aktiv ist
  // -------------------------------------------------------------------------

  test('DROPDOWN: Toggle schließt Menü auch wenn analytics-View aktiv ist', async ({ page }) => {
    await ensureAuthenticated(page, 'analytics-dashboard', { skipStyleGuide: true })
    await page.goto('/app/analytics')
    await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 15000 })
    await page.waitForFunction(
      () => {
        const view     = document.querySelector('[data-testid="analytics-view"]')
        const noAccess = document.querySelector('[data-testid="analytics-no-access"]')
        const loading  = document.querySelector('[data-testid="analytics-loading"]')
        return !!(view || noAccess) && !loading
      },
      { timeout: 20000 }
    )

    // Menü ist initial offen
    const toggle = page.getByTestId('sidebar-more-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Klick schließt – auch wenn isMoreViewActive noch true ist.
    // Das war der ursprüngliche Bug: desktopMoreOpen wurde durch isMoreViewActive
    // dauerhaft offen gehalten. Nach dem Fix steuert nur desktopMoreOpen die Sichtbarkeit.
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('sidebar-more-analytics')).not.toBeVisible()
  })
})
