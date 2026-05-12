import { test, expect } from '@playwright/test'
import {
  addDaysBerlin,
  attachConsoleTracking,
  buildTestEventTitle,
  cleanupOwnedTestData,
  createEventRecord,
  ensureAuthenticated,
  ensureParticipantStatusSchema,
  expectNoConsoleErrors,
  getAuthContext,
  getAuthedClient,
  insertBrokenEvent,
  isParticipantRlsFixed,
  isPublicPlatformSchemaReady,
  isStandPricingSchemaReady,
  openEvents,
  resetUserEvents,
  selectCity
} from './helpers/workflow'

test.describe.serial('MarketOS Events', () => {
  test('EVENT VALIDIERUNG + STADT-SUCHE: Pflichtfelder blocken sauber und Stadt kommt nur aus der Liste', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Validierung wird auf Desktop geprüft.')
    const errors = attachConsoleTracking(page)

    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const publicPlatformReady = await isPublicPlatformSchemaReady(credentials)
    expect(
      publicPlatformReady,
      'Public-Event-Schema fehlt noch in Supabase. Bitte public_platform_phase1.sql ausführen.'
    ).toBeTruthy()

    const futureEventDate = addDaysBerlin(14)

    await resetUserEvents(credentials)
    await page.reload()
    await openEvents(page, false)

    await page.getByTestId('save-event').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Bitte fülle alle Pflichtfelder aus/i)
    await expect(page.getByText('Eventname ist Pflicht.')).toBeVisible()
    await expect(page.getByText('Datum ist Pflicht.')).toBeVisible()
    await expect(page.getByText('Stadt ist Pflicht.')).toBeVisible()

    const cityInput = page.getByTestId('event-city')
    await cityInput.fill('X')
    await expect(page.getByText('Mindestens 2 Buchstaben eingeben.')).toBeVisible()

    await cityInput.fill('NichtEchteStadt')
    await expect(page.getByTestId('city-empty')).toBeVisible()
    await page.getByTestId('save-event').click()
    await expect(page.getByTestId('toast-message')).toContainText(
      /Bitte fülle alle Pflichtfelder aus|Bitte wähle eine Stadt aus der Liste aus/i
    )

    await cityInput.fill('Kamp-Lintfort')
    await expect(page.getByTestId('city-option')).toHaveCount(1)
    await expect(page.getByTestId('city-option').first()).toContainText('Kamp-Lintfort')
    await page.getByTestId('city-option').first().click()
    await expect(cityInput).toHaveValue('Kamp-Lintfort')
    await expectNoConsoleErrors(errors)
  })

  test('EVENT FLOW: Event startet intern, wird veröffentlicht und erscheint erst dann öffentlich', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Eventerstellung wird auf Desktop geprüft.')
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const publicPlatformReady = await isPublicPlatformSchemaReady(credentials)
    expect(
      publicPlatformReady,
      'Public-Event-Schema fehlt noch in Supabase. Bitte public_platform_phase1.sql ausführen.'
    ).toBeTruthy()
    const eventTitle = buildTestEventTitle('Event')
    const futureEventDate = addDaysBerlin(14)

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('10:00')
      await page.getByTestId('event-closing-time').fill('18:00')
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('event-public-description').fill(`${eventTitle} ist ein öffentlicher Markt für den Kern-Flow.`)
      await page.getByTestId('save-event').click()

      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)
      const eventCard = page.getByTestId('event-card').filter({ hasText: eventTitle }).first()
      await expect(eventCard.getByTestId('event-visibility-badge')).toContainText(/intern/i)
      await expect(eventCard.getByTestId('publish-event')).toBeVisible()

      await page.goto('/markets')
      await expect(page.getByTestId('public-markets-page')).toBeVisible()
      await expect(page.getByTestId('public-market-card').filter({ hasText: eventTitle })).toHaveCount(0)

      await page.goto('/app/events')
      await expect(page.getByTestId('event-list-card')).toBeVisible()
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('publish-event').click()

      await expect(page.getByTestId('toast-message')).toContainText(/Event veröffentlicht/i)
      await expect(
        page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('event-visibility-badge')
      ).toContainText(/öffentlich/i)

      await page.goto('/markets')
      await expect(page.getByTestId('public-market-card').filter({ hasText: eventTitle })).toBeVisible()
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('FEHLERHAFTE EVENTS: fehlerhafte Events sind sichtbar und direkt korrigierbar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Fehlerflow wird auf Desktop geprüft.')
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const publicPlatformReady = await isPublicPlatformSchemaReady(credentials)
    expect(
      publicPlatformReady,
      'Public-Event-Schema fehlt noch in Supabase. Bitte public_platform_phase1.sql ausführen.'
    ).toBeTruthy()
    const repairedTitle = buildTestEventTitle('RepairedEvent')

    try {
      await resetUserEvents(credentials)
      await insertBrokenEvent(credentials, repairedTitle)
      await page.reload()

      await expect(page.getByTestId('data-quality-warning')).toBeVisible()
      await page.getByTestId('data-quality-warning').click()
      await expect(page.getByTestId('event-form-card')).toBeVisible()

      const issueItem = page.getByTestId('event-issue-item').first()
      await expect(issueItem).toBeVisible()
      await issueItem.getByTestId('issue-edit-event').click()

      await expect(page.getByTestId('event-title')).toBeVisible()
      await page.getByTestId('event-title').fill(repairedTitle)
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('save-event').click()

      await expect(page.getByTestId('toast-message')).toContainText(/Event aktualisiert/i)
      await expect(page.getByTestId('event-list-card')).toContainText(repairedTitle)
      await expect(page.getByTestId('event-issue-item')).toHaveCount(0)
      await expect(page.getByTestId('data-quality-warning')).toHaveCount(0)
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [repairedTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('EVENT AUSSTELLERINFOS: interne Angaben sind sichtbar, speicherbar, reloaden korrekt und bleiben öffentlich verborgen', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-Eventformular wird auf Desktop geprüft.')
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const publicPlatformReady = await isPublicPlatformSchemaReady(credentials)
    expect(
      publicPlatformReady,
      'Public-Event-Schema fehlt noch in Supabase. Bitte public_platform_phase1.sql ausführen.'
    ).toBeTruthy()

    const eventTitle = buildTestEventTitle('ExhibitorInfoEvent')
    const futureEventDate = addDaysBerlin(21)
    const internalArrivalNotes = `${eventTitle} interne Anfahrt nur fuer Aussteller`
    const internalAccessNotes = `${eventTitle} Zufahrt ueber Tor C`
    const internalGeneralNotes = `${eventTitle} interne Zusatzinfo`

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      await expect(page.getByTestId('event-form-section-exhibitor-info')).toBeVisible()
      await expect(page.getByTestId('event-form-section-arrival')).toBeVisible()
      await expect(page.getByTestId('event-form-section-contacts')).toBeVisible()
      await expect(page.getByTestId('event-form-section-logistics')).toBeVisible()

      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('10:00')
      await page.getByTestId('event-closing-time').fill('18:00')
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('event-public-description').fill(`${eventTitle} ist öffentlich sichtbar.`)

      await page.getByTestId('event-setup-start-time').fill('08:00')
      await page.getByTestId('event-setup-end-time').fill('09:30')
      await page.getByTestId('event-teardown-start-time').fill('18:15')
      await page.getByTestId('event-teardown-end-time').fill('20:00')
      await page.getByTestId('event-arrival-notes').fill(internalArrivalNotes)
      await page.getByTestId('event-access-notes').fill(internalAccessNotes)
      await page.getByTestId('event-exhibitor-contact-name').fill('PW Einsatzleitung')
      await page.getByTestId('event-exhibitor-contact-phone').fill('+49 123 456789')
      await page.getByTestId('event-emergency-contact-name').fill('PW Notfall')
      await page.getByTestId('event-emergency-contact-phone').fill('+49 987 654321')
      await page.getByTestId('event-power-notes').fill('16A Strom vorhanden')
      await page.getByTestId('event-parking-notes').fill('Parken hinter Halle B')
      await page.getByTestId('event-waste-notes').fill('Bitte Müll trennen')
      await page.getByTestId('event-general-exhibitor-notes').fill(internalGeneralNotes)
      await page.getByTestId('save-event').click()

      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)

      const client = await getAuthedClient(credentials)
      const { data: savedEvent, error: eventError } = await client
        .from('events')
        .select('id,title')
        .eq('title', eventTitle)
        .maybeSingle()

      if (eventError) throw eventError
      expect(savedEvent?.id).toBeTruthy()

      await page.reload()
      await openEvents(page, false)
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('edit-event').click()

      await expect(page.getByTestId('event-setup-start-time')).toHaveValue('08:00:00')
      await expect(page.getByTestId('event-setup-end-time')).toHaveValue('09:30:00')
      await expect(page.getByTestId('event-teardown-start-time')).toHaveValue('18:15:00')
      await expect(page.getByTestId('event-teardown-end-time')).toHaveValue('20:00:00')
      await expect(page.getByTestId('event-arrival-notes')).toHaveValue(internalArrivalNotes)
      await expect(page.getByTestId('event-access-notes')).toHaveValue(internalAccessNotes)
      await expect(page.getByTestId('event-exhibitor-contact-name')).toHaveValue('PW Einsatzleitung')
      await expect(page.getByTestId('event-exhibitor-contact-phone')).toHaveValue('+49 123 456789')
      await expect(page.getByTestId('event-emergency-contact-name')).toHaveValue('PW Notfall')
      await expect(page.getByTestId('event-emergency-contact-phone')).toHaveValue('+49 987 654321')
      await expect(page.getByTestId('event-power-notes')).toHaveValue('16A Strom vorhanden')
      await expect(page.getByTestId('event-parking-notes')).toHaveValue('Parken hinter Halle B')
      await expect(page.getByTestId('event-waste-notes')).toHaveValue('Bitte Müll trennen')
      await expect(page.getByTestId('event-general-exhibitor-notes')).toHaveValue(internalGeneralNotes)

      await page.getByTestId('publish-event-form').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Event veröffentlicht/i)

      await page.goto('/markets')
      await expect(page.getByTestId('public-market-card').filter({ hasText: eventTitle })).toBeVisible()
      await expect(page.locator('body')).not.toContainText(internalArrivalNotes)
      await expect(page.locator('body')).not.toContainText(internalAccessNotes)
      await expect(page.locator('body')).not.toContainText(internalGeneralNotes)

      await page.goto(`/markets/${savedEvent.id}`)
      await expect(page.getByTestId('public-market-detail-page')).toBeVisible()
      await expect(page.locator('body')).not.toContainText(internalArrivalNotes)
      await expect(page.locator('body')).not.toContainText(internalAccessNotes)
      await expect(page.locator('body')).not.toContainText(internalGeneralNotes)
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('STANDFLÄCHEN HINWEIS: Beim Neuanlegen erscheint der Hinweis, beim Bearbeiten die Sektion', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Hinweis-Prüfung wird auf Desktop geprüft.')
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const eventTitle = buildTestEventTitle('StandHinweis')
    const futureEventDate = addDaysBerlin(28)

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      // Beim Neuanlegen: Hinweis sichtbar, Sektion nicht
      await expect(page.getByTestId('stand-pricing-new-event-hint')).toBeVisible()
      await expect(page.getByTestId('stand-pricing-section')).toHaveCount(0)

      // Event speichern
      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('09:00')
      await page.getByTestId('event-closing-time').fill('17:00')
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('save-event').click()
      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)

      // Beim Bearbeiten: Sektion sichtbar, Hinweis nicht
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('edit-event').click()
      await expect(page.getByTestId('stand-pricing-section')).toBeVisible()
      await expect(page.getByTestId('stand-pricing-new-event-hint')).toHaveCount(0)
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('STANDFLÄCHEN & PREISE: Standoptionen und Zusatzoptionen können angelegt, gespeichert und gelöscht werden', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Stand-Pricing-Formular wird auf Desktop geprüft.')
    test.setTimeout(90000)
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)

    const schemaReady = await isStandPricingSchemaReady(credentials)
    expect(
      schemaReady,
      'Stand-Pricing-Schema fehlt in Supabase. Bitte supabase/event_stand_pricing.sql ausführen.'
    ).toBeTruthy()

    const eventTitle = buildTestEventTitle('StandPricingUI')
    const futureEventDate = addDaysBerlin(21)
    const flatOptionLabel = 'PW_E2E_Pauschale Marktstandfläche'
    const tieredOptionLabel = 'PW_E2E_Staffelstand Frontlänge'
    const addonLabel = 'PW_E2E_Stromanschluss 16A'

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      // Event anlegen
      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('10:00')
      await page.getByTestId('event-closing-time').fill('18:00')
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('save-event').click()
      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)

      // Event öffnen zum Bearbeiten
      const eventCard = page.getByTestId('event-card').filter({ hasText: eventTitle }).first()
      await eventCard.getByTestId('edit-event').click()
      await expect(page.getByTestId('stand-pricing-section')).toBeVisible()

      // ---------------------------------------------------------------
      // SZENARIO 1: Standoption (flat) anlegen
      // ---------------------------------------------------------------
      await page.getByTestId('stand-option-add-btn').click()
      await expect(page.getByTestId('stand-option-form')).toBeVisible()

      await page.getByTestId('stand-option-label-input').fill(flatOptionLabel)
      await page.getByTestId('stand-option-area-type-select').selectOption('outdoor')
      await page.getByTestId('stand-option-pricing-type-select').selectOption('flat')
      await page.getByTestId('stand-option-price-input').fill('50,00')
      await page.getByTestId('stand-option-save-btn').click()
      await expect(page.getByTestId('toast-message')).toContainText(/gespeichert|Standoption/i)

      // SZENARIO 2: Standoption erscheint in Liste mit korrektem Preis
      const flatOptionRow = page.getByTestId('stand-option-item').filter({ hasText: flatOptionLabel })
      await expect(flatOptionRow).toBeVisible()
      await expect(page.getByTestId('stand-option-price-display').first()).toContainText('50,00')

      // SZENARIO 3: Reload – Standoption bleibt erhalten
      await page.reload()
      await openEvents(page, false)
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('edit-event').click()
      await expect(page.getByTestId('stand-option-item').filter({ hasText: flatOptionLabel })).toBeVisible()

      // ---------------------------------------------------------------
      // SZENARIO 4: Zweite Standoption (tiered_length) anlegen
      // ---------------------------------------------------------------
      await page.getByTestId('stand-option-add-btn').click()
      await expect(page.getByTestId('stand-option-form')).toBeVisible()

      await page.getByTestId('stand-option-label-input').fill(tieredOptionLabel)
      await page.getByTestId('stand-option-area-type-select').selectOption('outdoor')
      await page.getByTestId('stand-option-pricing-type-select').selectOption('tiered_length')
      await page.getByTestId('stand-option-save-btn').click()
      await expect(page.getByTestId('toast-message')).toContainText(/gespeichert|Standoption/i)

      // SZENARIO 5: Price Tiers aufklappen
      const tieredOptionRow = page.getByTestId('stand-option-item').filter({ hasText: tieredOptionLabel })
      await expect(tieredOptionRow).toBeVisible()
      await tieredOptionRow.getByTestId('price-tier-toggle-btn').click()
      await expect(tieredOptionRow.getByTestId('price-tier-list')).toBeVisible()

      // SZENARIO 6: Price Tier anlegen
      await tieredOptionRow.getByTestId('price-tier-add-btn').click()
      await expect(tieredOptionRow.getByTestId('price-tier-form')).toBeVisible()

      await tieredOptionRow.getByTestId('price-tier-price-input').fill('40,00')
      await tieredOptionRow.getByTestId('price-tier-save-btn').click()
      await expect(page.getByTestId('toast-message')).toContainText(/gespeichert|Preisbereich/i)
      await expect(tieredOptionRow.getByTestId('price-tier-item')).toHaveCount(1)

      // ---------------------------------------------------------------
      // SZENARIO 7: Addon anlegen
      // ---------------------------------------------------------------
      await page.getByTestId('addon-option-add-btn').click()
      await expect(page.getByTestId('addon-option-form')).toBeVisible()

      await page.getByTestId('addon-option-type-select').selectOption('electricity')
      await page.getByTestId('addon-option-label-input').fill(addonLabel)
      await page.getByTestId('addon-option-price-input').fill('10,00')
      await page.getByTestId('addon-option-save-btn').click()
      await expect(page.getByTestId('toast-message')).toContainText(/gespeichert|Zusatzoption/i)

      // SZENARIO 8: Addon erscheint in Liste
      const addonRow = page.getByTestId('addon-option-item').filter({ hasText: addonLabel })
      await expect(addonRow).toBeVisible()
      await expect(page.getByTestId('addon-option-price-display').first()).toContainText('10,00')

      // SZENARIO 9: Reload – Addon bleibt erhalten
      await page.reload()
      await openEvents(page, false)
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('edit-event').click()
      await expect(page.getByTestId('addon-option-item').filter({ hasText: addonLabel })).toBeVisible()

      // ---------------------------------------------------------------
      // SZENARIO 10: Addon löschen mit Bestätigung
      // ---------------------------------------------------------------
      const addonRowAfterReload = page.getByTestId('addon-option-item').filter({ hasText: addonLabel })
      await addonRowAfterReload.getByTestId('addon-option-delete-btn').click()
      await expect(page.getByTestId('delete-stand-item-modal')).toBeVisible()
      await page.getByTestId('delete-stand-item-modal-confirm').click()
      await expect(page.getByTestId('toast-message')).toContainText(/gelöscht|Zusatzoption/i)
      await expect(page.getByTestId('addon-option-item').filter({ hasText: addonLabel })).toHaveCount(0)

      // SZENARIO 11: Standoption löschen (Cascade-Hinweis erscheint für tiered_length)
      const tieredRowFinal = page.getByTestId('stand-option-item').filter({ hasText: tieredOptionLabel })
      await tieredRowFinal.getByTestId('stand-option-delete-btn').click()
      await expect(page.getByTestId('delete-stand-item-modal')).toBeVisible()
      await page.getByTestId('delete-stand-item-modal-confirm').click()
      await expect(page.getByTestId('toast-message')).toContainText(/gelöscht|Standoption/i)
      await expect(page.getByTestId('stand-option-item').filter({ hasText: tieredOptionLabel })).toHaveCount(0)

      // ---------------------------------------------------------------
      // SZENARIO 12: Kein öffentlicher Durchschlag
      // Event ist intern → /markets zeigt es nicht; Bezeichnung nicht sichtbar
      // ---------------------------------------------------------------
      await page.goto('/markets')
      await expect(page.getByTestId('public-markets-page')).toBeVisible()
      await expect(page.locator('body')).not.toContainText(flatOptionLabel)

      // SZENARIO 13: Leerzustand-Anzeigen sind korrekt nach dem Löschen aller Addons
      await page.goto('/app/events')
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('edit-event').click()
      await expect(page.getByTestId('stand-pricing-empty-addons')).toBeVisible()
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('EVENT IMPORT: Basisdaten und Ausstellerinfos können aus einem vorherigen Event übernommen werden', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Import-Flow wird auf Desktop geprüft.')
    test.setTimeout(90000)
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)

    const sourceTitle = buildTestEventTitle('ImportSource')
    const targetTitle = buildTestEventTitle('ImportTarget')
    const futureDate = addDaysBerlin(30)
    const laterDate = addDaysBerlin(60)

    try {
      await resetUserEvents(credentials)

      // ─── Setup: Zwei Events per API anlegen ─────────────────────────────

      // Quell-Event: public, mit Ausstellerinfos
      const sourceEvent = await createEventRecord(credentials, {
        title: sourceTitle,
        public_visible: true,
        event_date: futureDate
      })

      const client = await getAuthedClient(credentials)

      // Ausstellerinfos für Quell-Event anlegen
      const { error: srcInfoErr } = await client
        .from('event_exhibitor_info')
        .upsert(
          {
            event_id: sourceEvent.id,
            arrival_notes: `${sourceTitle}_Anfahrt`,
            access_notes: `${sourceTitle}_Zufahrt`,
            setup_start_time: '07:00',
            exhibitor_contact_name: `${sourceTitle}_Kontakt`
          },
          { onConflict: 'event_id' }
        )
      if (srcInfoErr) throw srcInfoErr

      // Ziel-Event: intern, kein exhibitorInfo
      const targetEvent = await createEventRecord(credentials, {
        title: targetTitle,
        public_visible: false,
        event_date: laterDate
      })

      // ─── SZENARIO 1: Import-Button fehlt beim Neuanlegen ─────────────────
      await page.reload()
      await openEvents(page, false)
      await expect(page.getByTestId('event-import-section')).toHaveCount(0)

      // ─── SZENARIO 2: Import-Button sichtbar beim Bearbeiten ──────────────
      await page.getByTestId('event-card').filter({ hasText: targetTitle }).first().getByTestId('edit-event').click()
      await expect(page.getByTestId('event-import-section')).toBeVisible()
      await expect(page.getByTestId('event-import-btn')).toBeVisible()
      await expect(page.getByTestId('event-import-dialog')).toHaveCount(0)

      // ─── SZENARIO 3: Dialog öffnet sich ──────────────────────────────────
      await page.getByTestId('event-import-btn').click()
      await expect(page.getByTestId('event-import-dialog')).toBeVisible()

      // ─── SZENARIO 4: Dropdown zeigt Quell-Event, nicht Ziel-Event ────────
      const sourceSelect = page.getByTestId('event-import-source-select')
      await expect(sourceSelect).toBeVisible()
      await expect(sourceSelect.locator(`option[value="${sourceEvent.id}"]`)).toHaveCount(1)
      await expect(sourceSelect.locator(`option[value="${targetEvent.id}"]`)).toHaveCount(0)

      // ─── SZENARIO 5: Beide Checkboxen standardmäßig aktiviert ────────────
      await expect(page.getByTestId('event-import-basics-checkbox')).toBeChecked()
      await expect(page.getByTestId('event-import-exhibitor-info-checkbox')).toBeChecked()

      // Submit-Button initial deaktiviert (kein Event gewählt)
      await expect(page.getByTestId('event-import-submit')).toBeDisabled()

      // ─── SZENARIO 6: Abbrechen schließt Dialog ohne Änderung ─────────────
      await page.getByTestId('event-import-cancel').click()
      await expect(page.getByTestId('event-import-dialog')).toHaveCount(0)
      // Titel-Feld ist noch das Ziel-Event
      await expect(page.getByTestId('event-title')).toHaveValue(targetTitle)

      // ─── SZENARIO 7: Basisdaten importieren ──────────────────────────────
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await sourceSelect.selectOption(sourceEvent.id)
      await expect(page.getByTestId('event-import-submit')).toBeEnabled()
      await page.getByTestId('event-import-submit').click()

      await expect(page.getByTestId('toast-message')).toContainText(/übernommen/i)
      await expect(page.getByTestId('event-import-dialog')).toHaveCount(0)

      // Titel wurde vom Quell-Event übernommen
      await expect(page.getByTestId('event-title')).toHaveValue(sourceTitle)

      // Datum wurde NICHT übernommen: Ziel-Event-Datum bleibt
      await expect(page.getByTestId('event-date')).toHaveValue(laterDate)

      // public_visible-Checkbox: Ziel-Event war intern → bleibt unklar/false
      // (public_visible des Quell-Events true darf NICHT übernommen worden sein)
      await expect(page.getByTestId('event-public-visible')).not.toBeChecked()

      // ─── SZENARIO 8: Ausstellerinfos importieren ──────────────────────────
      // Quell-Event neu aufrufen, diesmal nur Ausstellerinfos
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').check()
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)
      await page.getByTestId('event-import-submit').click()

      await expect(page.getByTestId('toast-message')).toContainText(/übernommen/i)
      await expect(page.getByTestId('event-arrival-notes')).toHaveValue(`${sourceTitle}_Anfahrt`)
      await expect(page.getByTestId('event-access-notes')).toHaveValue(`${sourceTitle}_Zufahrt`)
      await expect(page.getByTestId('event-exhibitor-contact-name')).toHaveValue(`${sourceTitle}_Kontakt`)

      // ─── SZENARIO 9: Überschreibe-Warnung wenn Ziel bereits Ausstellerinfos hat ──
      // Ziel-Event hat jetzt Ausstellerinfos im Formular → erneuter Import soll Warnung zeigen
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-exhibitor-info-checkbox').check()
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)
      await page.getByTestId('event-import-submit').click()

      // Confirm-Modal erscheint
      await expect(page.getByTestId('import-overwrite-modal')).toBeVisible()

      // ─── SZENARIO 10: Abbrechen des Overwrite-Modals ─────────────────────
      await page.getByTestId('import-overwrite-modal-cancel').click()
      await expect(page.getByTestId('import-overwrite-modal')).toHaveCount(0)
      // Dialog bleibt offen
      await expect(page.getByTestId('event-import-dialog')).toBeVisible()

      // ─── SZENARIO 11: Bestätigen des Overwrite-Modals ────────────────────
      await page.getByTestId('event-import-submit').click()
      await expect(page.getByTestId('import-overwrite-modal')).toBeVisible()
      await page.getByTestId('import-overwrite-modal-confirm').click()
      await expect(page.getByTestId('toast-message')).toContainText(/übernommen/i)
      await expect(page.getByTestId('event-import-dialog')).toHaveCount(0)

      // ─── SZENARIO 12: Keine Checkboxen ausgewählt → Submit bleibt deaktiviert ──
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').uncheck()
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)
      await expect(page.getByTestId('event-import-submit')).toBeDisabled()
      await page.getByTestId('event-import-cancel').click()

      // ─── SZENARIO 13: Import-Button verschwindet nach Abbrechen/Reset ────
      await page.getByTestId('event-card').filter({ hasText: sourceTitle }).first().getByTestId('edit-event').click()
      // Nach dem Import (Titel wurde zu sourceTitle geändert und das Event ist targetEvent)
      // → wir bearbeiten jetzt das targetEvent direkt über API-ID
      // Stattdessen: Abbrechen-Button im Formular zurücksetzen
      const cancelBtn = page.getByRole('button', { name: 'Abbrechen' }).last()
      await cancelBtn.click()
      await expect(page.getByTestId('event-import-section')).toHaveCount(0)
    } finally {
      await cleanupOwnedTestData(credentials, {
        eventTitles: [sourceTitle, targetTitle]
      })
    }

    await expectNoConsoleErrors(errors)
  })

  test('EVENT IMPORT STANDFLÄCHEN: Standflächen, Preisranges und Zusatzoptionen können aus einem vorherigen Event importiert werden', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Import-Standflächen-Flow wird auf Desktop geprüft.')
    test.setTimeout(120000)
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)

    const schemaReady = await isStandPricingSchemaReady(credentials)
    expect(
      schemaReady,
      'Stand-Pricing-Schema fehlt in Supabase. Bitte supabase/event_stand_pricing.sql ausführen.'
    ).toBeTruthy()

    const sourceTitle = buildTestEventTitle('StandImportSource')
    const targetTitle = buildTestEventTitle('StandImportTarget')
    const futureDate = addDaysBerlin(30)
    const laterDate = addDaysBerlin(60)

    try {
      await resetUserEvents(credentials)

      // ─── Setup: Quell-Event mit Standdaten ──────────────────────────────────
      const sourceEvent = await createEventRecord(credentials, {
        title: sourceTitle,
        public_visible: false,
        event_date: futureDate
      })
      const targetEvent = await createEventRecord(credentials, {
        title: targetTitle,
        public_visible: false,
        event_date: laterDate
      })

      const client = await getAuthedClient(credentials)

      // Standoption (flat) im Quell-Event anlegen
      const { data: srcOption, error: srcOptErr } = await client
        .from('event_stand_options')
        .insert({
          event_id: sourceEvent.id,
          label: 'PW_Import_Flat',
          area_type: 'outdoor',
          pricing_type: 'flat',
          price_cents: 5000,
          public_visible: true,
          sort_order: 0
        })
        .select('id')
        .single()
      if (srcOptErr) throw srcOptErr

      // Price Tier für diese Standoption
      const { error: srcTierErr } = await client
        .from('event_stand_price_tiers')
        .insert({
          stand_option_id: srcOption.id,
          label: 'PW_Import_Tier',
          price_cents: 3000,
          sort_order: 0
        })
      if (srcTierErr) throw srcTierErr

      // Addon im Quell-Event anlegen
      const { error: srcAddonErr } = await client
        .from('event_addon_options')
        .insert({
          event_id: sourceEvent.id,
          addon_type: 'electricity',
          label: 'PW_Import_Strom',
          price_cents: 1000,
          public_visible: true,
          sort_order: 0
        })
      if (srcAddonErr) throw srcAddonErr

      // ─── SZENARIO 1: Stand-Checkbox sichtbar + standardmäßig aktiviert ──────
      await page.reload()
      await openEvents(page, false)
      await page.getByTestId('event-card').filter({ hasText: targetTitle }).first().getByTestId('edit-event').click()
      await page.getByTestId('event-import-btn').click()
      await expect(page.getByTestId('event-import-dialog')).toBeVisible()
      await expect(page.getByTestId('event-import-stand-pricing-checkbox')).toBeVisible()
      await expect(page.getByTestId('event-import-stand-pricing-checkbox')).toBeChecked()

      // ─── SZENARIO 2: Hinweistext über nicht-öffentliche Freigabe sichtbar ───
      await expect(page.getByTestId('event-import-stand-pricing-hint')).toBeVisible()
      await expect(page.getByTestId('event-import-stand-pricing-hint')).toContainText(
        /nicht automatisch öffentlich/i
      )

      // ─── SZENARIO 3: Stand-Checkbox deaktiviert → kein Stand-Import ──────────
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').uncheck()
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)
      // Submit disabled wenn alle unchecked
      await expect(page.getByTestId('event-import-submit')).toBeDisabled()

      // ─── SZENARIO 11: Alle drei Checkboxen deaktiviert → Submit deaktiviert ─
      // (bereits geprüft in S3 — Submit bleibt deaktiviert)
      await expect(page.getByTestId('event-import-submit')).toBeDisabled()
      await page.getByTestId('event-import-cancel').click()

      // ─── SZENARIO 7: Nur Stand-Checkbox aktiviert → Basisdaten unverändert ──
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').check()
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)
      await expect(page.getByTestId('event-import-submit')).toBeEnabled()
      await page.getByTestId('event-import-submit').click()

      await expect(page.getByTestId('toast-message')).toContainText(/übernommen/i)
      // Titel bleibt targetTitle (Basisdaten wurden nicht importiert)
      await expect(page.getByTestId('event-title')).toHaveValue(targetTitle)

      // ─── SZENARIO 4: Importierte Standoptionen in Ziel-DB (public_visible=false) ─
      const { data: importedOptions, error: importedOptErr } = await client
        .from('event_stand_options')
        .select('id,label,public_visible')
        .eq('event_id', targetEvent.id)
      if (importedOptErr) throw importedOptErr
      expect(importedOptions).toHaveLength(1)
      expect(importedOptions[0].label).toBe('PW_Import_Flat')
      expect(importedOptions[0].public_visible).toBe(false)

      // ─── SZENARIO 5: Importierte Preisranges mit korrekter stand_option_id ───
      const newStandOptionId = importedOptions[0].id
      const { data: importedTiers, error: importedTierErr } = await client
        .from('event_stand_price_tiers')
        .select('id,label,stand_option_id,price_cents')
        .eq('stand_option_id', newStandOptionId)
      if (importedTierErr) throw importedTierErr
      expect(importedTiers).toHaveLength(1)
      expect(importedTiers[0].label).toBe('PW_Import_Tier')
      expect(importedTiers[0].stand_option_id).toBe(newStandOptionId)
      // Tier darf NICHT die alte source stand_option_id haben
      expect(importedTiers[0].stand_option_id).not.toBe(srcOption.id)

      // ─── SZENARIO 6: Importierte Zusatzoptionen in Ziel-DB (public_visible=false) ─
      const { data: importedAddons, error: importedAddonErr } = await client
        .from('event_addon_options')
        .select('id,label,public_visible')
        .eq('event_id', targetEvent.id)
      if (importedAddonErr) throw importedAddonErr
      expect(importedAddons).toHaveLength(1)
      expect(importedAddons[0].label).toBe('PW_Import_Strom')
      expect(importedAddons[0].public_visible).toBe(false)

      // ─── SZENARIO 8: Ziel mit bestehenden Standdaten → Overwrite-Confirm ────
      // Ziel hat jetzt eine Standoption → erneuter Import zeigt Warnung
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').check()
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)
      await page.getByTestId('event-import-submit').click()

      await expect(page.getByTestId('import-stand-overwrite-modal')).toBeVisible()

      // ─── SZENARIO 9: Abbrechen des Stand-Overwrite-Modals ────────────────────
      await page.getByTestId('import-stand-overwrite-modal-cancel').click()
      await expect(page.getByTestId('import-stand-overwrite-modal')).toHaveCount(0)
      // Dialog bleibt offen
      await expect(page.getByTestId('event-import-dialog')).toBeVisible()

      // ─── SZENARIO 10: Bestätigen des Stand-Overwrite-Modals → Import erfolgreich ─
      await page.getByTestId('event-import-submit').click()
      await expect(page.getByTestId('import-stand-overwrite-modal')).toBeVisible()
      await page.getByTestId('import-stand-overwrite-modal-confirm').click()
      await expect(page.getByTestId('toast-message')).toContainText(/übernommen/i)
      await expect(page.getByTestId('event-import-dialog')).toHaveCount(0)

      // Nach zweitem Import: 2 Standoptionen im Ziel (addiert, nicht ersetzt)
      const { data: optionsAfterSecond } = await client
        .from('event_stand_options')
        .select('id')
        .eq('event_id', targetEvent.id)
      expect(optionsAfterSecond).toHaveLength(2)

      // ─── SZENARIO 12: Quelle ohne Standdaten → Import erfolgreich ohne Fehler ─
      const emptySourceEvent = await createEventRecord(credentials, {
        title: buildTestEventTitle('StandImportEmpty'),
        public_visible: false,
        event_date: futureDate
      })
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').check()

      // Seite neu laden damit die neue Event-Option im Dropdown erscheint
      await page.getByTestId('event-import-cancel').click()
      await page.reload()
      await openEvents(page, false)
      await page.getByTestId('event-card').filter({ hasText: targetTitle }).first().getByTestId('edit-event').click()
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').check()
      await page.getByTestId('event-import-source-select').selectOption(emptySourceEvent.id)
      // Kein Stand-Overwrite-Dialog (Ziel hat Standdaten, aber wir prüfen auf Ziel, nicht Quelle)
      // → Overwrite-Confirm erscheint wegen bestehender Ziel-Daten
      await page.getByTestId('event-import-submit').click()
      await expect(page.getByTestId('import-stand-overwrite-modal')).toBeVisible()
      await page.getByTestId('import-stand-overwrite-modal-confirm').click()
      // Import aus leereer Quelle: kein Fehler, kein Toast-Fehler
      await expect(page.getByTestId('toast-message')).toContainText(/übernommen/i)

      // ─── SZENARIO 13: Importierte Daten sind nicht öffentlich (/markets) ────
      // Stand-Daten haben public_visible=false → tauchen auf /markets nicht auf
      await page.goto('/markets')
      await expect(page.getByTestId('public-markets-page')).toBeVisible()
      await expect(page.locator('body')).not.toContainText('PW_Import_Flat')
      await expect(page.locator('body')).not.toContainText('PW_Import_Strom')

      // ─── SZENARIO 14: Dialog erneut öffnen → Stand-Checkbox wieder aktiviert ─
      await page.goto('/app/events')
      await page.getByTestId('event-card').filter({ hasText: targetTitle }).first().getByTestId('edit-event').click()
      await page.getByTestId('event-import-btn').click()
      // Stand-Checkbox ist beim Öffnen immer checked (Reset durch openImportDialog)
      await expect(page.getByTestId('event-import-stand-pricing-checkbox')).toBeChecked()
      await page.getByTestId('event-import-cancel').click()

      await cleanupOwnedTestData(credentials, {
        eventTitles: [buildTestEventTitle('StandImportEmpty')]
      })
    } finally {
      await cleanupOwnedTestData(credentials, {
        eventTitles: [sourceTitle, targetTitle]
      })
    }

    await expectNoConsoleErrors(errors)
  })

  test('EVENT IMPORT STANDFLÄCHEN LEER: Quellevent ohne Standdaten lässt das Ziel-Event leer', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Import-Leerfall wird auf Desktop geprüft.')
    test.setTimeout(60000)
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)

    const schemaReady = await isStandPricingSchemaReady(credentials)
    expect(
      schemaReady,
      'Stand-Pricing-Schema fehlt in Supabase. Bitte supabase/event_stand_pricing.sql ausführen.'
    ).toBeTruthy()

    const sourceTitle = buildTestEventTitle('StandEmptySource')
    const targetTitle = buildTestEventTitle('StandEmptyTarget')
    const futureDate = addDaysBerlin(35)
    const laterDate = addDaysBerlin(65)

    try {
      await resetUserEvents(credentials)

      // Beide Events ohne jegliche Standdaten
      const sourceEvent = await createEventRecord(credentials, {
        title: sourceTitle,
        public_visible: false,
        event_date: futureDate
      })
      const targetEvent = await createEventRecord(credentials, {
        title: targetTitle,
        public_visible: false,
        event_date: laterDate
      })

      const client = await getAuthedClient(credentials)

      // Vorbedingung: Quelle ist wirklich leer
      const { data: preSrcOptions } = await client
        .from('event_stand_options')
        .select('id')
        .eq('event_id', sourceEvent.id)
      expect(preSrcOptions).toHaveLength(0)

      const { data: preSrcAddons } = await client
        .from('event_addon_options')
        .select('id')
        .eq('event_id', sourceEvent.id)
      expect(preSrcAddons).toHaveLength(0)

      // ─── Import ausführen ────────────────────────────────────────────────────
      await page.reload()
      await openEvents(page, false)
      await page.getByTestId('event-card').filter({ hasText: targetTitle }).first().getByTestId('edit-event').click()
      await page.getByTestId('event-import-btn').click()
      await expect(page.getByTestId('event-import-dialog')).toBeVisible()

      // Nur Stand-Checkbox aktiv
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').check()
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)

      // Kein Overwrite-Confirm (Ziel hat keine Standdaten)
      await page.getByTestId('event-import-submit').click()
      await expect(page.getByTestId('import-stand-overwrite-modal')).toHaveCount(0)

      // Erfolgsmeldung, kein Fehler
      await expect(page.getByTestId('toast-message')).toContainText(/übernommen/i)
      await expect(page.getByTestId('event-import-dialog')).toHaveCount(0)

      // ─── DB-Assertion: Ziel bleibt leer ─────────────────────────────────────
      const { data: targetOptions, error: optErr } = await client
        .from('event_stand_options')
        .select('id')
        .eq('event_id', targetEvent.id)
      if (optErr) throw optErr
      expect(targetOptions, 'Ziel-Event darf nach Leerquelle keine Standoptionen haben').toHaveLength(0)

      const { data: targetAddons, error: addErr } = await client
        .from('event_addon_options')
        .select('id')
        .eq('event_id', targetEvent.id)
      if (addErr) throw addErr
      expect(targetAddons, 'Ziel-Event darf nach Leerquelle keine Zusatzoptionen haben').toHaveLength(0)

      // Price-Tiers: da keine Standoptionen im Ziel, kann es auch keine Tiers geben
      // (Tiers sind per FK an event_stand_options gebunden → implizit 0)
      // Explizit bestätigen über leere Standoptionsliste als Kontrolle
      expect(targetOptions).toHaveLength(0) // keine IDs zum Prüfen von Tiers → 0 Tiers garantiert
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [sourceTitle, targetTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('EVENT IMPORT TEILNEHMER: Aussteller können selektiv aus einem vorherigen Event übernommen werden', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Teilnehmer-Import-Flow wird auf Desktop geprüft.')
    test.setTimeout(120000)
    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)

    await ensureParticipantStatusSchema(credentials)

    const rlsFixed = await isParticipantRlsFixed()
    expect(
      rlsFixed,
      'Teilnehmer-RLS-Fix fehlt noch in Supabase. Bitte supabase/fix_participants_rls.sql ausführen.'
    ).toBeTruthy()

    const sourceTitle = buildTestEventTitle('TeilnImportSrc')
    const targetTitle = buildTestEventTitle('TeilnImportTgt')
    const emptySourceTitle = buildTestEventTitle('TeilnImportEmpty')
    const futureDate = addDaysBerlin(30)
    const laterDate = addDaysBerlin(60)

    try {
      await resetUserEvents(credentials)

      // Alle Setup-Operationen mit einem einzigen authentifizierten Client
      // (gleiche Session für Event- und Teilnehmer-Inserts – exakt das Muster
      // das auch event-detail.spec.js für funktionierende Teilnehmer-Inserts nutzt)
      const client = await getAuthedClient(credentials)
      const authUser = await getAuthContext(client)
      const userId = authUser.id

      const { data: loc, error: locErr } = await client
        .from('locations')
        .select('id,name')
        .eq('name', 'Kamp-Lintfort')
        .eq('postal_code', '47475')
        .maybeSingle()
      if (locErr) throw locErr
      if (!loc) throw new Error('Test-Standort Kamp-Lintfort (47475) wurde nicht gefunden.')

      const { data: sourceEvent, error: srcErr } = await client
        .from('events')
        .insert({
          organizer_id: userId,
          title: sourceTitle,
          event_date: futureDate,
          location_id: loc.id,
          location: loc.name,
          public_visible: false,
          opening_time: '10:00',
          closing_time: '18:00',
          public_description: `PW_E2E_Quell-Event für Teilnehmer-Import.`
        })
        .select()
        .single()
      if (srcErr) throw srcErr

      const { data: targetEvent, error: tgtErr } = await client
        .from('events')
        .insert({
          organizer_id: userId,
          title: targetTitle,
          event_date: laterDate,
          location_id: loc.id,
          location: loc.name,
          public_visible: false,
          opening_time: '10:00',
          closing_time: '18:00',
          public_description: `PW_E2E_Ziel-Event für Teilnehmer-Import.`
        })
        .select()
        .single()
      if (tgtErr) throw tgtErr

      const { data: emptySourceEvent, error: emptyErr } = await client
        .from('events')
        .insert({
          organizer_id: userId,
          title: emptySourceTitle,
          event_date: futureDate,
          location_id: loc.id,
          location: loc.name,
          public_visible: false,
          opening_time: '10:00',
          closing_time: '18:00',
          public_description: `PW_E2E_Leeres Quell-Event für Teilnehmer-Import.`
        })
        .select()
        .single()
      if (emptyErr) throw emptyErr

      // ─── Setup: Teilnehmer im Quell-Event anlegen ────────────────────────────

      // A: bestaetigt, bezahlt, hat Stand
      const { data: pA, error: errA } = await client
        .from('event_participants')
        .insert({
          event_id: sourceEvent.id,
          exhibitor_name: 'PW_Import_AusA',
          email: 'pwa@test.local',
          exhibitor_id: null,
          status: 'bestaetigt',
          paid: true,
          booth: 'A1'
        })
        .select('id')
        .single()
      if (errA) throw new Error(`Teilnehmer A konnte nicht angelegt werden: ${errA.message} (code=${errA.code})`)

      // B: warteliste, nicht bezahlt, kein Stand
      const { data: pB, error: errB } = await client
        .from('event_participants')
        .insert({
          event_id: sourceEvent.id,
          exhibitor_name: 'PW_Import_AusB',
          email: 'pwb@test.local',
          exhibitor_id: null,
          status: 'warteliste',
          paid: false,
          booth: null
        })
        .select('id')
        .single()
      if (errB) throw new Error(`Teilnehmer B konnte nicht angelegt werden: ${errB.message} (code=${errB.code})`)

      // C: abgesagt — gleiche E-Mail wie bestehender Ziel-Teilnehmer D
      const { data: pC, error: errC } = await client
        .from('event_participants')
        .insert({
          event_id: sourceEvent.id,
          exhibitor_name: 'PW_Import_AusC',
          email: 'pwc@test.local',
          exhibitor_id: null,
          status: 'abgesagt',
          paid: false,
          booth: null
        })
        .select('id')
        .single()
      if (errC) throw new Error(`Teilnehmer C konnte nicht angelegt werden: ${errC.message} (code=${errC.code})`)

      // D: bereits im Ziel-Event — gleiche E-Mail wie C (für Dedup-Test)
      const { error: errD } = await client
        .from('event_participants')
        .insert({
          event_id: targetEvent.id,
          exhibitor_name: 'PW_Target_AusD',
          email: 'pwc@test.local',
          exhibitor_id: null,
          status: 'angefragt',
          paid: false,
          booth: null
        })
      if (errD) throw new Error(`Teilnehmer D konnte nicht angelegt werden: ${errD.message} (code=${errD.code})`)

      // ─── SZENARIO 1+2: Checkbox sichtbar, standardmäßig nicht aktiviert ─────
      await page.reload()
      await openEvents(page, false)
      await page.getByTestId('event-card').filter({ hasText: targetTitle }).first().getByTestId('edit-event').click()
      await page.getByTestId('event-import-btn').click()
      await expect(page.getByTestId('event-import-dialog')).toBeVisible()
      await expect(page.getByTestId('event-import-participants-checkbox')).toBeVisible()
      await expect(page.getByTestId('event-import-participants-checkbox')).not.toBeChecked()

      // ─── Aktivieren, Quelle noch nicht gewählt → Hinweis wählen ─────────────
      await page.getByTestId('event-import-participants-checkbox').check()
      await expect(page.getByTestId('event-import-participants-section')).toBeVisible()
      // Kein Quellevent gewählt → kein Fehler, kein Absturz (nur Hinweis)
      await expect(page.getByTestId('event-import-participants-list')).toHaveCount(0)

      // ─── SZENARIO 3: Quellevent wählen → Teilnehmerliste erscheint ───────────
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)
      await expect(page.getByTestId('event-import-participants-list')).toBeVisible()
      const rows = page.getByTestId('event-import-participant-row')
      await expect(rows).toHaveCount(3)

      // ─── SZENARIO 4: Kontext-Felder für Teilnehmer A sichtbar ───────────────
      // Status-Kontext zeigt alten Status (bestaetigt → "Bestätigt")
      const rowA = rows.filter({ hasText: 'PW_Import_AusA' })
      await expect(rowA.getByTestId('event-import-participant-status')).toContainText(/Bestätigt/i)
      await expect(rowA.getByTestId('event-import-participant-paid')).toContainText(/Bezahlt/i)
      await expect(rowA.getByTestId('event-import-participant-booth')).toContainText('A1')

      // ─── SZENARIO 5: Keine Zeile ist standardmäßig ausgewählt ───────────────
      await expect(page.getByTestId(`event-import-participant-check-${pA.id}`)).not.toBeChecked()
      await expect(page.getByTestId(`event-import-participant-check-${pB.id}`)).not.toBeChecked()
      await expect(page.getByTestId(`event-import-participant-check-${pC.id}`)).not.toBeChecked()

      // ─── SZENARIO 13: Nur Teilnehmerimport aktiv, keiner gewählt → Fehlermeldung ──
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').uncheck()
      // Noch kein Teilnehmer ausgewählt
      await page.getByTestId('event-import-submit').click()
      await expect(page.getByTestId('toast-message')).toContainText(/mindestens einen Teilnehmer/i)

      // ─── SZENARIO 6: Nur Teilnehmer A auswählen und importieren ─────────────
      await page.getByTestId(`event-import-participant-check-${pA.id}`).check()
      await page.getByTestId('event-import-submit').click()

      await expect(page.getByTestId('toast-message')).toContainText(/übernommen/i)
      await expect(page.getByTestId('toast-message')).toContainText(/1 Aussteller importiert/i)
      await expect(page.getByTestId('event-import-dialog')).toHaveCount(0)

      // ─── SZENARIO 7: Importierter Teilnehmer hat korrekte neue Werte ─────────
      const { data: importedParticipants, error: impErr } = await client
        .from('event_participants')
        .select('exhibitor_name,email,status,paid,booth')
        .eq('event_id', targetEvent.id)
        .eq('exhibitor_name', 'PW_Import_AusA')
      if (impErr) throw impErr
      expect(importedParticipants).toHaveLength(1)
      // S7: status = 'angefragt' (nicht 'bestaetigt')
      expect(importedParticipants[0].status).toBe('angefragt')
      // S8/S9: paid = false (nicht true), S10: booth = null (nicht 'A1')
      expect(importedParticipants[0].paid).toBe(false)
      expect(importedParticipants[0].booth).toBeNull()

      // Ziel hat jetzt 2 Teilnehmer: D (vorher) + A (importiert)
      const { data: allTargetParts } = await client
        .from('event_participants')
        .select('id')
        .eq('event_id', targetEvent.id)
      expect(allTargetParts).toHaveLength(2)

      // ─── SZENARIO 11: Teilnehmer C (gleiche E-Mail wie D) → Dedup ────────────
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-basics-checkbox').uncheck()
      await page.getByTestId('event-import-exhibitor-info-checkbox').uncheck()
      await page.getByTestId('event-import-stand-pricing-checkbox').uncheck()
      await page.getByTestId('event-import-participants-checkbox').check()
      await page.getByTestId('event-import-source-select').selectOption(sourceEvent.id)
      await expect(page.getByTestId('event-import-participants-list')).toBeVisible()
      await page.getByTestId(`event-import-participant-check-${pC.id}`).check()
      await page.getByTestId('event-import-submit').click()

      // Erfolgsmeldung nennt "übersprungen"
      await expect(page.getByTestId('toast-message')).toContainText(/übersprungen/i)
      await expect(page.getByTestId('event-import-dialog')).toHaveCount(0)

      // C wurde NICHT importiert (Ziel bleibt bei 2)
      const { data: afterDedup } = await client
        .from('event_participants')
        .select('id')
        .eq('event_id', targetEvent.id)
      expect(afterDedup).toHaveLength(2)

      // ─── SZENARIO 12: Quellevent ohne Teilnehmer → Empty-State ──────────────
      await page.getByTestId('event-import-btn').click()
      await page.getByTestId('event-import-participants-checkbox').check()
      await page.getByTestId('event-import-source-select').selectOption(emptySourceEvent.id)
      await expect(page.getByTestId('event-import-participants-empty')).toBeVisible()
      await expect(page.getByTestId('event-import-participants-empty')).toContainText(
        /keine Teilnehmer hinterlegt/i
      )
      await page.getByTestId('event-import-cancel').click()

      // ─── SZENARIO 15: Public Pages bleiben unverändert ──────────────────────
      await page.goto('/markets')
      await expect(page.getByTestId('public-markets-page')).toBeVisible()
      await expect(page.locator('body')).not.toContainText('PW_Import_AusA')
      await expect(page.locator('body')).not.toContainText('PW_Import_AusB')
      await expect(page.locator('body')).not.toContainText('pwa@test.local')
    } finally {
      await cleanupOwnedTestData(credentials, {
        eventTitles: [sourceTitle, targetTitle, emptySourceTitle]
      })
    }

    await expectNoConsoleErrors(errors)
  })
})
