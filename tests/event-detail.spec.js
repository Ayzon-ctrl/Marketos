import { test, expect } from '@playwright/test'
import {
  addDaysBerlin,
  attachConsoleTracking,
  buildTestEventTitle,
  buildTestVendorName,
  cleanupOwnedTestData,
  ensureAuthenticated,
  ensureParticipantStatusSchema,
  ensureVendorProfile,
  expectNoConsoleErrors,
  getAuthedClient,
  getTestCategory,
  isPublicPlatformSchemaReady,
  isStandPricingSchemaReady,
  openEvents,
  resetUserEvents,
  runId,
  selectCity
} from './helpers/workflow'

async function expandEventDetailPanels(section, options = { briefing: true, preview: true }) {
  if (options.briefing) {
    const briefingPanelCount = await section.getByTestId('event-exhibitor-info-briefing').count()
    if (briefingPanelCount === 0) {
      await section.getByTestId('event-exhibitor-info-briefing-toggle').click()
    }
  }

  if (options.preview) {
    const previewPanelCount = await section.getByTestId('event-exhibitor-info-print-preview').count()
    if (previewPanelCount === 0) {
      await section.getByTestId('event-exhibitor-info-preview-toggle').click()
    }
  }
}

async function expandParticipantList(section) {
  const expandedCount = await section.getByTestId('event-detail-participants-list').count()
  if (expandedCount === 0) {
    await section.getByTestId('event-detail-participants-toggle').click()
  }
}

test.describe.serial('MarketOS Event Detail', () => {
  test('EVENT DETAIL: Veranstalter veröffentlicht Event, verknüpft Händler und nimmt das Event wieder aus der Öffentlichkeit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Kernflow wird auf Desktop geprüft.')
    test.setTimeout(60000)

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const publicPlatformReady = await isPublicPlatformSchemaReady(credentials)
    expect(
      publicPlatformReady,
      'Public-Event-Schema fehlt noch in Supabase. Bitte public_platform_phase1.sql ausführen.'
    ).toBeTruthy()

    const eventTitle = buildTestEventTitle('DetailEvent')
    const vendorBusinessName = buildTestVendorName('Händler')
    const vendorCategory = getTestCategory(`${testInfo.project.name}-${runId}`)
    const futureEventDate = addDaysBerlin(14)
    const openPaymentName = `Alpha Offen ${runId}`
    const missingBoothName = `Beta Ohne Stand ${runId}`
    const reviewName = `Delta Pruefung ${runId}`
    const waitlistName = `Epsilon Warteliste ${runId}`
    const confirmedName = `Gamma Bestaetigt ${runId}`
    const cancelledName = `Zulu Abgesagt ${runId}`

    try {
      await ensureParticipantStatusSchema(credentials)
      await ensureVendorProfile(credentials, {
        business_name: vendorBusinessName,
        category: vendorCategory,
        description: `${vendorBusinessName} ist ein öffentliches Testprofil für den Event-Flow.`
      })
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('10:00')
      await page.getByTestId('event-closing-time').fill('18:00')
      await page.getByTestId('event-public-description').fill(`${eventTitle} ist ein vollständiges öffentliches Event für den Kern-Flow.`)
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('save-event').click()
      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)

      const eventCard = page.getByTestId('event-card').filter({ hasText: eventTitle }).first()
      await eventCard.getByTestId('publish-event').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Event veröffentlicht/i)
      await eventCard.getByTestId('open-event-detail').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()
      await expect(page.getByTestId('event-detail-visibility')).toContainText(/öffentlich/i)

      const exhibitorInfoSection = page.getByTestId('event-exhibitor-info-section')
      await expect(exhibitorInfoSection).toBeVisible()
      await expandEventDetailPanels(exhibitorInfoSection)
      await expect(exhibitorInfoSection).toContainText(/Ausstellerinfos vorbereiten/i)
      await expect(exhibitorInfoSection).toContainText(/wichtigsten Informationen für Aussteller/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-status')).toContainText(
        /Pflichtangaben vorhanden/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-title')).toContainText(eventTitle)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-location')).toContainText(
        /Kamp-Lintfort/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-opening_hours')).toContainText(/10:00/)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-opening_hours')).toContainText(/18:00/)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-setup_time')).toContainText(
        /Fehlt noch/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-arrival_notes')).toContainText(
        /Fehlt noch/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-contact_person')).toContainText(
        /Fehlt noch/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-missing-summary')).toContainText(
        /Angaben fehlen/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-status-title')).toContainText(
        /Briefing noch unvollst.ndig/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-status-text')).toContainText(
        /Noch 4 Pflichtangaben fehlen/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-status-missing')).toContainText(
        /Aufbauzeit/i
      )
      // Notfallkontakt ist jetzt optional – erscheint nicht mehr in fehlenden Pflichtangaben
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-status-missing')).not.toContainText(
        /Notfallkontakt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-next-step')).toContainText(
        /Erg.nze die fehlenden Angaben im Eventformular/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-group-preparation')).toContainText(
        /Vorbereitung/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-group-briefing')).toContainText(
        /Briefing/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-group-internal-preview')).toContainText(
        /Interne Vorschau/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview')).toContainText(
        /Vorschau für Aussteller/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-summary')).toContainText(
        eventTitle
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-summary')).toContainText(
        /Kamp-Lintfort/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-summary')).toContainText(
        /Öffnungszeiten:/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-description')).toContainText(
        /vollst.*ffentliches Event/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-missing')).toContainText(
        /Noch zu ergänzen:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-missing')).toContainText(
        /Aufbauzeit/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-missing')).toContainText(
        /Ansprechpartner/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft')).toContainText(
        /Textentwurf aus vorhandenen Angaben/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-event')).toContainText(
        eventTitle
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-event')).toContainText(
        /Kamp-Lintfort/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-opening-hours')).toContainText(
        /Öffnungszeiten: 10:00 Uhr/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-notes')).toContainText(
        /vollständiges öffentliches Event/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-missing')).toContainText(
        /Noch offen für die finale Ausstellerinfo:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-missing')).toContainText(
        /Aufbauzeit/i
      )
      // Notfallkontakt ist jetzt optional – erscheint nicht mehr in der fehlenden-Liste
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-missing')).not.toContainText(
        /Notfallkontakt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing')).toContainText(
        /Aussteller-Briefing/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-event')).toContainText(eventTitle)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-event')).toContainText(
        /Kamp-Lintfort/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-setup')).toContainText(
        /Aufbauzeit noch nicht vollständig hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-arrival')).toContainText(
        /Anfahrt noch nicht hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-arrival')).toContainText(
        /Zufahrt noch nicht hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-contact')).toContainText(
        /Ansprechpartner noch nicht hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Noch keine Teilnehmer f.r dieses Event hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Teilnehmer . Standinformationen/i
      )
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-hint')
      ).toContainText(/Stand- und Zahlungsinformationen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-issues')
      ).toContainText(/Keine offenen Teilnehmerpunkte aus den vorhandenen Daten erkannt/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')
      ).toContainText(/Noch keine Teilnehmer f.r dieses Event hinterlegt/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-summary')
      ).toHaveCount(0)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview')).toContainText(
        /Druckfreundliche Vorschau/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-missing')).toContainText(
        /Noch offen:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-contact')).toContainText(
        /Notfallkontakt noch nicht hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-missing')).toContainText(
        /Noch offen für ein vollständiges Briefing:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-missing')).toContainText(
        /Aufbauzeit/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message')).toContainText(
        /Kopierbare Briefing-Nachricht/i
      )
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-standard')
      ).toContainText(/Standard/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-short')
      ).toContainText(/Kurz/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-checklist')
      ).toContainText(/Checkliste/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-warning')
      ).toContainText(/Briefing ist noch unvollst.ndig/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Hallo zusammen/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        eventTitle
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Kamp-Lintfort/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Noch offen vor finaler Weitergabe:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Aufbauzeit/i
      )
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-short').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Teilnehmerhinweis:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-button')).toContainText(
        /Kurz kopieren/i
      )
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-checklist').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Checkliste zum Briefing:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /- Event:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-button')).toContainText(
        /Checkliste kopieren/i
      )
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-button').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Briefing-Text wurde kopiert/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-feedback')
      ).toContainText(/Briefing-Text wurde kopiert/i)
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-standard').click()
      await expect(exhibitorInfoSection.getByRole('button', { name: /pdf|versenden|ki|exportieren/i })).toHaveCount(0)
      await expect(exhibitorInfoSection.getByRole('button', { name: /empf.nger|whatsapp|e-mail/i })).toHaveCount(0)

      const linkedVendorSelect = page.getByTestId('detail-participant-linked-vendor')
      const linkedVendorValue = await linkedVendorSelect
        .locator('option')
        .filter({ hasText: vendorBusinessName })
        .evaluate(option => option.value)
      await linkedVendorSelect.selectOption(linkedVendorValue)
      await page.getByTestId('detail-participant-name').fill(vendorBusinessName)
      await page.getByTestId('detail-participant-email').fill(`teilnehmer-${runId}@example.com`)
      await page.getByTestId('detail-participant-booth').fill('')
      await page.getByTestId('detail-participant-status').selectOption('bestaetigt')
      await page.getByTestId('detail-save-participant').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Teilnehmer .*Event hinzugefügt/i)
      await expandParticipantList(page.getByTestId('event-detail-participants'))
      await expect(page.getByTestId('event-detail-participants')).toContainText(vendorBusinessName)
      await expandEventDetailPanels(exhibitorInfoSection)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Teilnehmer . Standinformationen/i
      )
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-hint')
      ).toContainText(/Teilnehmerliste des Events/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-summary')
      ).toContainText(/1 Teilnehmer/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-summary')
      ).toContainText(/1 best.tigt/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-summary')
      ).toContainText(/1 Zahlung offen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-summary')
      ).toContainText(/1 ohne Stand/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-issues')
      ).toContainText(/Offene Teilnehmerpunkte/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-issues')
      ).toContainText(/1 Zahlung offen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-issues')
      ).toContainText(/1 Teilnehmer ohne Stand/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        vendorBusinessName
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Stand noch nicht hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Best.tigt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Zahlung offen/i
      )
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')
      ).toContainText(/Teilnehmer . Standinformationen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-hint')
      ).toContainText(/Teilnehmerliste des Events/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-summary')
      ).toContainText(/1 Teilnehmer/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-summary')
      ).toContainText(/1 ohne Stand/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-issues')
      ).toContainText(/Offene Teilnehmerpunkte/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-issues')
      ).toContainText(/1 Zahlung offen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-issues')
      ).toContainText(/1 Teilnehmer ohne Stand/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')
      ).toContainText(vendorBusinessName)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')
      ).toContainText(/Stand noch nicht hinterlegt/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')
      ).toContainText(/Zahlung offen/i)

      const client = await getAuthedClient(credentials)
      const { data: savedEvent, error: savedEventError } = await client
        .from('events')
        .select('id')
        .eq('title', eventTitle)
        .maybeSingle()
      if (savedEventError) throw savedEventError
      expect(savedEvent?.id).toBeTruthy()

      const { data: linkedVendorProfile, error: linkedVendorProfileError } = await client
        .from('vendor_profiles')
        .select('owner_id')
        .eq('business_name', vendorBusinessName)
        .maybeSingle()
      if (linkedVendorProfileError) throw linkedVendorProfileError
      expect(linkedVendorProfile?.owner_id).toBeTruthy()

      const participantCard = page
        .getByTestId('detail-participant-item')
        .filter({ hasText: vendorBusinessName })
        .first()
      await participantCard.getByTestId('detail-participant-status-select').selectOption('bestaetigt')
      await expect(page.getByTestId('toast-message')).toContainText(/Teilnehmerstatus auf "Best.tigt" gesetzt/i)
      await expect(participantCard).toContainText(/Best.tigt/i)
      await participantCard.getByTestId('detail-participant-status-select').selectOption('abgesagt')
      await expect(page.getByTestId('toast-message')).toContainText(/Teilnehmerstatus auf "Abgesagt" gesetzt/i)
      await expect(participantCard).toContainText(/Abgesagt/i)
      await participantCard.getByTestId('detail-toggle-paid').click()
      await expect(page.getByTestId('toast-message')).toContainText(/als bezahlt markiert/i)
      await expect(participantCard).toContainText(/Bezahlt/i)
      await participantCard.getByTestId('detail-toggle-paid').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Zahlungsstatus auf offen gesetzt/i)
      await expect(participantCard).toContainText(/Offen/i)

      await page.getByTestId('detail-open-participants-view').click()
      await expect(page).toHaveURL(/\/app\/participants$/)
      const participantRow = page.getByTestId('participants-page-item').filter({ hasText: vendorBusinessName }).first()
      await expect(participantRow).toContainText(/Abgesagt/i)
      await expect(participantRow).toContainText(/Offen/i)
      await participantRow.getByTestId('participants-page-status-select').selectOption('bestaetigt')
      await expect(page.getByTestId('toast-message')).toContainText(/Teilnehmerstatus auf "Best.tigt" gesetzt/i)
      await expect(participantRow).toContainText(/Best.tigt/i)
      await participantRow.getByTestId('participants-page-paid-toggle').click()
      await expect(page.getByTestId('toast-message')).toContainText(/als bezahlt markiert/i)
      await expect(participantRow).toContainText(/Bezahlt/i)
      await participantRow.getByTestId('participants-page-paid-toggle').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Zahlungsstatus auf offen gesetzt/i)
      await expect(participantRow).toContainText(/Offen/i)
      await page.goto(`/app/events/${savedEvent.id}`)
      await expect(page.getByTestId('event-detail-view')).toBeVisible()
      await expandParticipantList(page.getByTestId('event-detail-participants'))
      await expect(
        page.getByTestId('detail-participant-item').filter({ hasText: vendorBusinessName }).first()
      ).toContainText(/Best.tigt/i)
      await expect(
        page.getByTestId('detail-participant-item').filter({ hasText: vendorBusinessName }).first()
      ).toContainText(/Offen/i)

      const { error: participantInsertError } = await client.from('event_participants').insert([
        {
          event_id: savedEvent.id,
          exhibitor_id: linkedVendorProfile.owner_id,
          exhibitor_name: openPaymentName,
          email: `offen-${runId}@example.com`,
          booth: 'A-1',
          status: 'bestaetigt',
          paid: false
        },
        {
          event_id: savedEvent.id,
          exhibitor_id: linkedVendorProfile.owner_id,
          exhibitor_name: missingBoothName,
          email: `ohne-stand-${runId}@example.com`,
          booth: null,
          status: 'bestaetigt',
          paid: true
        },
        {
          event_id: savedEvent.id,
          exhibitor_id: linkedVendorProfile.owner_id,
          exhibitor_name: reviewName,
          email: `pruefung-${runId}@example.com`,
          booth: 'D-4',
          status: 'angefragt',
          paid: true
        },
        {
          event_id: savedEvent.id,
          exhibitor_id: linkedVendorProfile.owner_id,
          exhibitor_name: waitlistName,
          email: `warteliste-${runId}@example.com`,
          booth: 'E-5',
          status: 'warteliste',
          paid: true
        },
        {
          event_id: savedEvent.id,
          exhibitor_id: linkedVendorProfile.owner_id,
          exhibitor_name: confirmedName,
          email: `bestaetigt-${runId}@example.com`,
          booth: 'G-7',
          status: 'bestaetigt',
          paid: true
        },
        {
          event_id: savedEvent.id,
          exhibitor_id: linkedVendorProfile.owner_id,
          exhibitor_name: cancelledName,
          email: `abgesagt-${runId}@example.com`,
          booth: 'Z-9',
          status: 'abgesagt',
          paid: true
        }
      ])
      if (participantInsertError) throw participantInsertError

      await page.goto('/app/events')
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('open-event-detail').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()
      await expandEventDetailPanels(exhibitorInfoSection)

      const briefingParticipantsText = await exhibitorInfoSection
        .getByTestId('event-exhibitor-info-briefing-participants')
        .innerText()
      expect(briefingParticipantsText.indexOf(openPaymentName)).toBeGreaterThan(-1)
      expect(briefingParticipantsText.indexOf(missingBoothName)).toBeGreaterThan(-1)
      expect(briefingParticipantsText.indexOf(reviewName)).toBeGreaterThan(-1)
      expect(briefingParticipantsText.indexOf(waitlistName)).toBeGreaterThan(-1)
      expect(briefingParticipantsText.indexOf(confirmedName)).toBeGreaterThan(-1)
      expect(briefingParticipantsText.indexOf(cancelledName)).toBeGreaterThan(-1)
      expect(briefingParticipantsText.indexOf(openPaymentName)).toBeLessThan(
        briefingParticipantsText.indexOf(confirmedName)
      )
      expect(briefingParticipantsText.indexOf(missingBoothName)).toBeLessThan(
        briefingParticipantsText.indexOf(confirmedName)
      )
      expect(briefingParticipantsText.indexOf(reviewName)).toBeLessThan(
        briefingParticipantsText.indexOf(confirmedName)
      )
      expect(briefingParticipantsText.indexOf(waitlistName)).toBeLessThan(
        briefingParticipantsText.indexOf(confirmedName)
      )
      expect(briefingParticipantsText.indexOf(confirmedName)).toBeLessThan(
        briefingParticipantsText.indexOf(cancelledName)
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /In Pr.fung/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Warteliste/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        confirmedName
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Stand G-7/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants')).toContainText(
        /Bezahlt/i
      )
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-issues')
      ).toContainText(/2 Zahlungen offen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-issues')
      ).toContainText(/2 Teilnehmer ohne Stand/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-issues')
      ).toContainText(/1 Teilnehmer in Pr/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-participants-issues')
      ).toContainText(/1 Teilnehmer auf Warteliste/i)

      const printPreviewParticipantsText = await exhibitorInfoSection
        .getByTestId('event-exhibitor-info-print-preview-participants')
        .innerText()
      expect(printPreviewParticipantsText.indexOf(openPaymentName)).toBeLessThan(
        printPreviewParticipantsText.indexOf(confirmedName)
      )
      expect(printPreviewParticipantsText.indexOf(missingBoothName)).toBeLessThan(
        printPreviewParticipantsText.indexOf(confirmedName)
      )
      expect(printPreviewParticipantsText.indexOf(reviewName)).toBeLessThan(
        printPreviewParticipantsText.indexOf(confirmedName)
      )
      expect(printPreviewParticipantsText.indexOf(waitlistName)).toBeLessThan(
        printPreviewParticipantsText.indexOf(confirmedName)
      )
      expect(printPreviewParticipantsText.indexOf(confirmedName)).toBeLessThan(
        printPreviewParticipantsText.indexOf(cancelledName)
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')).toContainText(
        /In Pr.fung/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')).toContainText(
        /Warteliste/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')).toContainText(
        confirmedName
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')).toContainText(
        /Stand G-7/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')).toContainText(
        /Bezahlt/i
      )
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-issues')
      ).toContainText(/2 Zahlungen offen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-issues')
      ).toContainText(/2 Teilnehmer ohne Stand/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-issues')
      ).toContainText(/1 Teilnehmer in Pr/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-issues')
      ).toContainText(/1 Teilnehmer auf Warteliste/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Teilnehmerhinweis:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /7 Teilnehmer insgesamt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /2 Zahlungen offen/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /2 Teilnehmer ohne Stand/i
      )
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-short').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /7 Teilnehmer insgesamt/i
      )
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-standard').click()
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-button').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Briefing-Text wurde kopiert/i)
      await expect(exhibitorInfoSection.getByRole('button', { name: /sort|filter|suche/i })).toHaveCount(0)

      await page.goto('/markets')
      await expect(page.getByTestId('public-market-card').filter({ hasText: eventTitle })).toBeVisible()
      await page
        .getByTestId('public-market-card')
        .filter({ hasText: eventTitle })
        .first()
        .getByRole('link', { name: /Details ansehen/i })
        .click()
      await expect(page.getByTestId('public-market-detail-page')).toBeVisible()
      await expect(page.getByText('1 Händler')).toBeVisible()
      await expect(page.getByTestId('public-vendor-card')).toContainText(vendorBusinessName)
      await expect(page.getByTestId('public-vendor-card')).toContainText(vendorCategory)

      await page.goto('/app/events')
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('unpublish-event').click()
      await expect(page.getByTestId('toast-message')).toContainText(/wieder intern/i)
      await expect(
        page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('event-visibility-badge')
      ).toContainText(/intern/i)

      await page.goto('/markets')
      await expect(page.getByTestId('public-market-card').filter({ hasText: eventTitle })).toHaveCount(0)
    } finally {
      await cleanupOwnedTestData(credentials, {
        eventTitles: [eventTitle],
        vendorNames: [vendorBusinessName]
      })
    }

    await expectNoConsoleErrors(errors)
  })

  test('EVENT DETAIL AUSSTELLERINFOS: Readiness, Vorschau und Textentwurf nutzen event_exhibitor_info', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop-EventDetail wird auf Desktop geprüft.')

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const publicPlatformReady = await isPublicPlatformSchemaReady(credentials)
    expect(
      publicPlatformReady,
      'Public-Event-Schema fehlt noch in Supabase. Bitte public_platform_phase1.sql ausführen.'
    ).toBeTruthy()

    const eventTitle = buildTestEventTitle('DetailExhibitorInfo')
    const futureEventDate = addDaysBerlin(18)
    const arrivalNotes = `${eventTitle} Anfahrt über Parkplatz Süd`
    const accessNotes = `${eventTitle} Zufahrt nur über Tor B`
    const generalNotes = `${eventTitle} Bitte 30 Minuten vor Marktstart aufbauen`

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('10:00')
      await page.getByTestId('event-closing-time').fill('18:00')
      await page.getByTestId('event-public-description').fill(`${eventTitle} ist ein internes Testevent für Ausstellerinfos.`)
      await selectCity(page, '47475', 'Kamp-Lintfort')

      await page.getByTestId('event-setup-start-time').fill('08:00')
      await page.getByTestId('event-setup-end-time').fill('09:30')
      await page.getByTestId('event-teardown-start-time').fill('18:15')
      await page.getByTestId('event-teardown-end-time').fill('20:00')
      await page.getByTestId('event-arrival-notes').fill(arrivalNotes)
      await page.getByTestId('event-access-notes').fill(accessNotes)
      await page.getByTestId('event-exhibitor-contact-name').fill('PW Einsatzleitung')
      await page.getByTestId('event-exhibitor-contact-phone').fill('+49 123 456789')
      await page.getByTestId('event-emergency-contact-name').fill('PW Notfall')
      await page.getByTestId('event-emergency-contact-phone').fill('+49 987 654321')
      await page.getByTestId('event-power-notes').fill('16A Strom vorhanden')
      await page.getByTestId('event-parking-notes').fill('Parken hinter Halle B')
      await page.getByTestId('event-waste-notes').fill('Bitte Müll trennen')
      await page.getByTestId('event-general-exhibitor-notes').fill(generalNotes)
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
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('open-event-detail').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()

      const exhibitorInfoSection = page.getByTestId('event-exhibitor-info-section')
      await expandEventDetailPanels(exhibitorInfoSection)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-status')).toContainText(
        /8 von 8 Pflichtangaben vorhanden/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-missing-summary')).toContainText(
        /Alle Pflichtangaben sind vorbereitet/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-status-title')).toContainText(
        /Briefing vollst.ndig vorbereitet/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-status-text')).toContainText(
        /Alle Pflichtangaben sind hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-next-step')).toContainText(
        /Grundlage f.r Kopie, Versand oder PDF vorbereitet/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-status-missing')).toHaveCount(0)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-group-preparation')).toContainText(
        /Vorbereitung/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-group-briefing')).toContainText(
        /Briefing/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-group-internal-preview')).toContainText(
        /Interne Vorschau/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-setup_time')).toContainText(/08:00/)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-setup_time')).toContainText(/09:30/)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-arrival_notes')).toContainText(
        arrivalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-access_notes')).toContainText(
        accessNotes
      )
      // Optional-Felder zeigen "Vorhanden" wenn vorhanden — nicht "Optional" und nicht "Fehlt noch"
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-access_notes')).toContainText(/Vorhanden/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-access_notes')).not.toContainText(/Fehlt noch/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-teardown_time')).toContainText(/18:15/)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-teardown_time')).toContainText(/20:00/)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-contact_person')).toContainText(
        /PW Einsatzleitung/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-contact_person')).toContainText(
        /\+49 123 456789/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-emergency_contact')).toContainText(
        /PW Notfall/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-emergency_contact')).toContainText(
        /\+49 987 654321/
      )
      // Notfallkontakt zeigt "Vorhanden" wenn vorhanden — nicht "Optional" und nicht "Fehlt noch"
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-emergency_contact')).toContainText(/Vorhanden/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-item-emergency_contact')).not.toContainText(/Fehlt noch/i)

      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-setup')).toContainText(/08:00/)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-arrival')).toContainText(
        arrivalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-access')).toContainText(
        accessNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-contact')).toContainText(
        /PW Einsatzleitung/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-emergency')).toContainText(
        /PW Notfall/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-logistics')).toContainText(
        /16A Strom vorhanden/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-logistics')).toContainText(
        /Parken hinter Halle B/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-logistics')).toContainText(
        /Bitte Müll trennen/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-logistics')).toContainText(
        generalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-missing')).toContainText(
        /Aktuell sind alle Pflichtangaben in dieser Vorschau vorhanden/i
      )

      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-setup')).toContainText(/08:00/)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-arrival')).toContainText(
        arrivalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-contact')).toContainText(
        /PW Einsatzleitung/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-teardown')).toContainText(
        /18:15/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-facts')).toContainText(
        /16A Strom vorhanden/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-notes')).toContainText(
        generalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-draft-missing')).toContainText(
        /Aktuell sind alle Pflichtangaben für die finale Ausstellerinfo vorhanden/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-event')).toContainText(eventTitle)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-event')).toContainText(
        /Öffnungszeiten:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-setup')).toContainText(
        /Du kannst von 08:00/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-arrival')).toContainText(
        arrivalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-arrival')).toContainText(
        accessNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-teardown')).toContainText(
        /18:15/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-contact')).toContainText(
        /PW Einsatzleitung/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-contact')).toContainText(
        /PW Notfall/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-logistics')).toContainText(
        /16A Strom vorhanden/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-logistics')).toContainText(
        /Parken hinter Halle B/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-logistics')).toContainText(
        /Bitte Müll trennen/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-logistics')).toContainText(
        generalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-missing')).toContainText(
        /Alle Pflichtangaben für das Briefing sind hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-warning')).toHaveCount(0)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-standard')
      ).toContainText(/Standard/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-short')
      ).toContainText(/Kurz/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-checklist')
      ).toContainText(/Checkliste/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Hallo zusammen/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        eventTitle
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Kamp-Lintfort/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Aufbau: 08:00/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        arrivalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /PW Einsatzleitung/
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Aktuell noch keine Teilnehmer hinterlegt/i
      )
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-short').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Teilnehmerhinweis:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-button')).toContainText(
        /Kurz kopieren/i
      )
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-variant-checklist').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /Checkliste zum Briefing:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(
        /- Kontakt:/i
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-button')).toContainText(
        /Checkliste kopieren/i
      )
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-copy-message-button').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Briefing-Text wurde kopiert/i)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-summary')).toContainText(
        eventTitle
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-arrival')).toContainText(
        arrivalNotes
      )
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-contact')).toContainText(
        /PW Einsatzleitung/
      )
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')
      ).toContainText(/Teilnehmer . Standinformationen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-hint')
      ).toContainText(/Stand- und Zahlungsinformationen/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-issues')
      ).toContainText(/Keine offenen Teilnehmerpunkte aus den vorhandenen Daten erkannt/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants')
      ).toContainText(/Noch keine Teilnehmer f.r dieses Event hinterlegt/i)
      await expect(
        exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-participants-summary')
      ).toHaveCount(0)
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview-missing')).toContainText(
        /Alle Pflichtangaben sind hinterlegt/i
      )
      await expect(exhibitorInfoSection.getByRole('button', { name: /pdf|versenden|ki|exportieren/i })).toHaveCount(0)
      await expect(exhibitorInfoSection.getByRole('button', { name: /empf.nger|whatsapp|e-mail/i })).toHaveCount(0)
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('BRIEFING OPTIONAL FELDER: Zufahrt und Notfallkontakt sind optional – Briefing ist trotzdem bereit wenn sie fehlen', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Optionale-Felder-Prüfung wird auf Desktop geprüft.')

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const publicPlatformReady = await isPublicPlatformSchemaReady(credentials)
    expect(
      publicPlatformReady,
      'Public-Event-Schema fehlt noch in Supabase. Bitte public_platform_phase1.sql ausführen.'
    ).toBeTruthy()

    const eventTitle = buildTestEventTitle('OptionalFelder')
    const futureEventDate = addDaysBerlin(22)
    const arrivalNotes = `${eventTitle} Anfahrt über Haupteingang`

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      // Event mit allen 8 Pflichtfeldern anlegen – OHNE access_notes und OHNE Notfallkontakt
      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('10:00')
      await page.getByTestId('event-closing-time').fill('18:00')
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('event-setup-start-time').fill('08:00')
      await page.getByTestId('event-setup-end-time').fill('09:00')
      await page.getByTestId('event-teardown-start-time').fill('18:30')
      await page.getByTestId('event-teardown-end-time').fill('20:00')
      await page.getByTestId('event-arrival-notes').fill(arrivalNotes)
      await page.getByTestId('event-exhibitor-contact-name').fill('PW Pflichtleitung')
      await page.getByTestId('event-exhibitor-contact-phone').fill('+49 111 222333')
      // access_notes NICHT befüllen
      // emergency_contact_name/phone NICHT befüllen
      await page.getByTestId('save-event').click()
      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)

      await page.reload()
      await openEvents(page, false)
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('open-event-detail').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()

      const infoSection = page.getByTestId('event-exhibitor-info-section')
      await expandEventDetailPanels(infoSection)

      // ─── Pflichtanzahl: 8 von 8 ─────────────────────────────────────────
      await expect(infoSection.getByTestId('event-exhibitor-info-status')).toContainText(
        /8 von 8 Pflichtangaben vorhanden/i
      )
      await expect(infoSection.getByTestId('event-exhibitor-info-missing-summary')).toContainText(
        /Alle Pflichtangaben sind vorbereitet/i
      )

      // ─── Briefing-Status: Bereit ─────────────────────────────────────────
      await expect(infoSection.getByTestId('event-exhibitor-info-briefing-status-title')).toContainText(
        /Briefing vollst.ndig vorbereitet/i
      )
      await expect(infoSection.getByTestId('event-exhibitor-info-briefing-status-pill')).toContainText(/Bereit/i)
      await expect(infoSection.getByTestId('event-exhibitor-info-briefing-status-missing')).toHaveCount(0)

      // ─── Einfahrt / Zufahrt: "Optional" – nicht "Fehlt noch" ────────────
      await expect(infoSection.getByTestId('event-exhibitor-info-item-access_notes')).toContainText(/Optional/i)
      await expect(infoSection.getByTestId('event-exhibitor-info-item-access_notes')).not.toContainText(/Fehlt noch/i)

      // ─── Notfallkontakt: "Optional" – nicht "Fehlt noch" ────────────────
      await expect(infoSection.getByTestId('event-exhibitor-info-item-emergency_contact')).toContainText(/Optional/i)
      await expect(infoSection.getByTestId('event-exhibitor-info-item-emergency_contact')).not.toContainText(/Fehlt noch/i)

      // ─── Briefing-Missing: keine fehlenden Pflichtangaben ───────────────
      await expect(infoSection.getByTestId('event-exhibitor-info-briefing-missing')).toContainText(
        /Alle Pflichtangaben für das Briefing sind hinterlegt/i
      )

      // ─── Druckvorschau: keine fehlenden Pflichtangaben ──────────────────
      await expect(infoSection.getByTestId('event-exhibitor-info-print-preview-missing')).toContainText(
        /Alle Pflichtangaben sind hinterlegt/i
      )

      // ─── Kopierbare Nachricht: kein "Noch offen"-Abschnitt ──────────────
      await expect(infoSection.getByTestId('event-exhibitor-info-copy-message-warning')).toHaveCount(0)
      await expect(infoSection.getByTestId('event-exhibitor-info-copy-message-body')).not.toContainText(
        /Noch offen vor finaler Weitergabe/i
      )
      // Zufahrt-Datenzeile erscheint nicht, wenn access_notes leer ist
      // (die Sektionsüberschrift "Anfahrt & Zufahrt:" bleibt, aber kein "Zufahrt: <Wert>")
      await expect(infoSection.getByTestId('event-exhibitor-info-copy-message-body')).not.toContainText(/Zufahrt: \S/i)
      // Notfallkontakt-Zeile erscheint nicht, wenn emergency_contact leer ist
      await expect(infoSection.getByTestId('event-exhibitor-info-copy-message-body')).not.toContainText(/Notfallkontakt:/i)
      // Anfahrt erscheint weiterhin (Pflichtfeld, vorhanden)
      await expect(infoSection.getByTestId('event-exhibitor-info-copy-message-body')).toContainText(arrivalNotes)

      // ─── Textentwurf: kein Missing-Eintrag für Zufahrt / Notfallkontakt ─
      await expect(infoSection.getByTestId('event-exhibitor-info-draft-missing')).toContainText(
        /Aktuell sind alle Pflichtangaben für die finale Ausstellerinfo vorhanden/i
      )
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('WORKFLOW: EventDetail bündelt Aktionen früher und hält ToDos beim Hinzufügen im Fokus', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Workflow wird auf Desktop geprüft.')
    test.setTimeout(90000)

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)
    const eventTitle = buildTestEventTitle('WorkflowDetail')
    const futureEventDate = addDaysBerlin(10)
    const taskTitle = `Workflow ToDo ${runId}`

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('09:00')
      await page.getByTestId('event-closing-time').fill('17:00')
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('save-event').click()
      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)

      const eventCard = page.getByTestId('event-card').filter({ hasText: eventTitle }).first()
      await eventCard.getByTestId('open-event-detail').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()
      await expect(page.getByTestId('event-detail-publish')).toBeVisible()
      await expect(page.getByTestId('event-detail-visibility')).toContainText(/intern/i)
      await expect(page.getByTestId('event-detail-participants-collapsed-summary')).toContainText(
        /0 Teilnehmer/i
      )
      await expect(page.getByTestId('event-detail-participants-list')).toHaveCount(0)

      const participantsBox = await page.getByTestId('event-detail-participants').boundingBox()
      const tasksBox = await page.getByTestId('event-detail-tasks').boundingBox()
      const briefingBox = await page.getByTestId('event-exhibitor-info-section').boundingBox()
      const updatesBox = await page.getByTestId('event-public-updates-section').boundingBox()
      const detailViewBox = await page.getByTestId('event-detail-view').boundingBox()
      expect(participantsBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(briefingBox?.y ?? 0)
      expect(tasksBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(briefingBox?.y ?? 0)
      expect(updatesBox?.y ?? Number.POSITIVE_INFINITY).toBeGreaterThan(briefingBox?.y ?? 0)
      expect((updatesBox?.width ?? 0) * 1.5).toBeLessThan(detailViewBox?.width ?? Number.POSITIVE_INFINITY)

      const exhibitorInfoSection = page.getByTestId('event-exhibitor-info-section')
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-edit-event')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-toggle')).toBeVisible()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-toggle')).toBeVisible()

      await exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-toggle').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing')).toBeVisible()
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing-toggle').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-briefing')).toHaveCount(0)

      await exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-toggle').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview')).toBeVisible()
      await exhibitorInfoSection.getByTestId('event-exhibitor-info-preview-toggle').click()
      await expect(exhibitorInfoSection.getByTestId('event-exhibitor-info-print-preview')).toHaveCount(0)

      const participantSection = page.getByTestId('event-detail-participants')
      await participantSection.getByTestId('event-detail-participants-toggle').click()
      await expect(participantSection.getByTestId('event-detail-participants-list')).toBeVisible()
      await participantSection.getByTestId('event-detail-participants-toggle').click()
      await expect(participantSection.getByTestId('event-detail-participants-list')).toHaveCount(0)

      const tasksSection = page.getByTestId('event-detail-tasks')
      await tasksSection.scrollIntoViewIfNeeded()
      await page.getByTestId('detail-task-title').fill(taskTitle)
      await page.getByTestId('detail-save-task').click()
      await expect(page.getByTestId('toast-message')).toContainText(/ToDo .*gespeichert/i)
      await expect(tasksSection).toContainText(taskTitle)
      const tasksStillVisible = await tasksSection.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return rect.top < window.innerHeight && rect.bottom > 0
      })
      expect(tasksStillVisible).toBeTruthy()

      await page.getByTestId('event-detail-publish').click()
      await expect(page.getByTestId('toast-message')).toContainText(/Event veröffentlicht/i)
      await expect(page.getByTestId('event-detail-visibility')).toContainText(/öffentlich/i)
      await expect(page.getByTestId('event-detail-unpublish')).toBeVisible()

      await exhibitorInfoSection.getByTestId('event-exhibitor-info-edit-event').click()
      await expect(page.getByTestId('event-form-card')).toBeVisible()
      await expect(page.getByTestId('event-title')).toHaveValue(eventTitle)
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })

  test('PREISVORSCHAU: Standflächen, Preisranges und Zusatzoptionen werden verständlich im EventDetail angezeigt', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Preisvorschau wird auf Desktop geprüft.')
    test.setTimeout(90000)

    const errors = attachConsoleTracking(page)
    const credentials = await ensureAuthenticated(page, testInfo.project.name)

    const schemaReady = await isStandPricingSchemaReady(credentials)
    expect(
      schemaReady,
      'Stand-Pricing-Schema fehlt in Supabase. Bitte supabase/event_stand_pricing.sql ausführen.'
    ).toBeTruthy()

    const eventTitle = buildTestEventTitle('PreisvorschauDetail')
    const futureEventDate = addDaysBerlin(21)

    try {
      await resetUserEvents(credentials)
      await page.reload()
      await openEvents(page, false)

      await page.getByTestId('event-title').fill(eventTitle)
      await page.getByTestId('event-date').fill(futureEventDate)
      await page.getByTestId('event-opening-time').fill('10:00')
      await page.getByTestId('event-closing-time').fill('18:00')
      await selectCity(page, '47475', 'Kamp-Lintfort')
      await page.getByTestId('save-event').click()
      await expect(page.getByTestId('toast-message')).toContainText(/noch intern/i)

      // Event-ID holen
      const client = await getAuthedClient(credentials)
      const { data: savedEvent, error: eventError } = await client
        .from('events')
        .select('id')
        .eq('title', eventTitle)
        .maybeSingle()
      if (eventError) throw eventError
      expect(savedEvent?.id).toBeTruthy()

      // 1. Preisvorschau im EventDetail öffnen — Leerzustand prüfen
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('open-event-detail').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()

      const exhibitorSection = page.getByTestId('event-exhibitor-info-section')
      await expandEventDetailPanels(exhibitorSection, { briefing: false, preview: true })
      const pricingPreview = exhibitorSection.getByTestId('event-stand-pricing-preview')

      await expect(pricingPreview).toBeVisible()
      await expect(pricingPreview).toContainText(/Preisvorschau für Aussteller/i)

      // 8. Empty-State wenn keine Preis-/Standdaten vorhanden
      await expect(pricingPreview.getByTestId('event-stand-pricing-preview-empty')).toBeVisible()
      await expect(pricingPreview).toContainText(/Noch keine Standflächen oder Zusatzoptionen hinterlegt/i)
      await expect(pricingPreview).toContainText(/Pflege diese Angaben im Eventformular/i)

      // Testdaten per Supabase-Client anlegen (ohne UI, für Geschwindigkeit)
      const { data: flatOption, error: flatErr } = await client
        .from('event_stand_options')
        .insert({
          event_id: savedEvent.id,
          label: 'PW_E2E_Außenstand pauschal',
          area_type: 'outdoor',
          surface_types: ['wiese'],
          pricing_type: 'flat',
          price_cents: 3500,
          is_available: true,
          public_visible: false,
          sort_order: 0
        })
        .select('id')
        .single()
      if (flatErr) throw flatErr

      const { data: upToOption, error: upToErr } = await client
        .from('event_stand_options')
        .insert({
          event_id: savedEvent.id,
          label: 'PW_E2E_Stand bis 3m Frontlänge',
          area_type: 'outdoor',
          surface_types: [],
          pricing_type: 'up_to_length',
          max_length_m: 3.0,
          price_cents: 5000,
          is_available: true,
          public_visible: false,
          sort_order: 1
        })
        .select('id')
        .single()
      if (upToErr) throw upToErr

      const { data: tieredOption, error: tieredErr } = await client
        .from('event_stand_options')
        .insert({
          event_id: savedEvent.id,
          label: 'PW_E2E_Staffelstand Frontlänge',
          area_type: 'outdoor',
          surface_types: [],
          pricing_type: 'tiered_length',
          is_available: true,
          public_visible: false,
          sort_order: 2
        })
        .select('id')
        .single()
      if (tieredErr) throw tieredErr

      // Price-Tiers für tiered_length-Option
      const { error: tier1Err } = await client.from('event_stand_price_tiers').insert({
        stand_option_id: tieredOption.id,
        min_length_m: 0,
        max_length_m: 3.0,
        price_cents: 4000,
        is_price_on_request: false,
        sort_order: 0
      })
      if (tier1Err) throw tier1Err

      const { error: tier2Err } = await client.from('event_stand_price_tiers').insert({
        stand_option_id: tieredOption.id,
        min_length_m: 3.0,
        max_length_m: null,
        price_cents: null,
        is_price_on_request: true,
        sort_order: 1
      })
      if (tier2Err) throw tier2Err

      // Zusatzoption anlegen
      const { error: addonErr } = await client.from('event_addon_options').insert({
        event_id: savedEvent.id,
        addon_type: 'electricity',
        label: 'PW_E2E_Stromanschluss 16A',
        price_cents: 1000,
        is_price_on_request: false,
        is_available: true,
        public_visible: false,
        sort_order: 0
      })
      if (addonErr) throw addonErr

      // Reload → EventDetail neu öffnen
      await page.goto('/app/events')
      await page.getByTestId('event-card').filter({ hasText: eventTitle }).first().getByTestId('open-event-detail').click()
      await expect(page.getByTestId('event-detail-view')).toBeVisible()
      await expandEventDetailPanels(exhibitorSection, { briefing: false, preview: true })
      const refreshedPricingPreview = page
        .getByTestId('event-exhibitor-info-section')
        .getByTestId('event-stand-pricing-preview')

      // 1. Preisvorschau ist sichtbar
      await expect(refreshedPricingPreview).toBeVisible()
      await expect(refreshedPricingPreview).toContainText(/Preisvorschau für Aussteller/i)

      // 2. Standoption mit Pauschalpreis (flat)
      await expect(refreshedPricingPreview).toContainText('PW_E2E_Außenstand pauschal')
      await expect(refreshedPricingPreview).toContainText('Pauschale Standgebühr: 35,00 €')

      // 3. Standoption up_to_length
      await expect(refreshedPricingPreview).toContainText('PW_E2E_Stand bis 3m Frontlänge')
      await expect(refreshedPricingPreview).toContainText(/Bis 3 m Frontlänge: 50,00 €/)

      // 4. tiered_length zeigt Preisranges
      await expect(refreshedPricingPreview).toContainText('PW_E2E_Staffelstand Frontlänge')
      await expect(refreshedPricingPreview).toContainText(/Bis 3 m Frontlänge: 40,00 €/)

      // 5. Preis auf Anfrage
      await expect(refreshedPricingPreview).toContainText(/Preis auf Anfrage/i)

      // 6. Zusatzoption wird angezeigt
      await expect(refreshedPricingPreview).toContainText('PW_E2E_Stromanschluss 16A')
      await expect(refreshedPricingPreview).toContainText('10,00 €')

      // 7. Zusatzoption mit Typ-Label korrekt
      await expect(refreshedPricingPreview).toContainText('Stromanschluss')

      // 9. Keine Bearbeiten-/Löschen-/Anlegen-Buttons in der Vorschau
      await expect(
        refreshedPricingPreview.getByRole('button', { name: /bearbeiten|löschen|anlegen|hinzufügen|speichern/i })
      ).toHaveCount(0)

      // 10. Public Pages zeigen interne Preisinfos nicht
      await page.goto('/markets')
      await expect(page.getByTestId('public-markets-page')).toBeVisible()
      await expect(page.locator('body')).not.toContainText('PW_E2E_Außenstand pauschal')
      await expect(page.locator('body')).not.toContainText('PW_E2E_Staffelstand Frontlänge')
      await expect(page.locator('body')).not.toContainText('Preisvorschau für Aussteller')
    } finally {
      await cleanupOwnedTestData(credentials, { eventTitles: [eventTitle] })
    }

    await expectNoConsoleErrors(errors)
  })
})
