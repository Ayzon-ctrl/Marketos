import { test, expect } from '@playwright/test'
import {
  buildTestEventTitle,
  cleanupOwnedTestData,
  createEventRecord,
  ensureAuthenticated,
  getAnonClient,
  getAuthedClient
} from './helpers/workflow'

function expectBlockedRead(result) {
  const data = result?.data
  const error = result?.error

  expect(Boolean(error) || (Array.isArray(data) && data.length === 0) || data == null).toBeTruthy()
}

function expectBlockedWrite(result) {
  const data = result?.data
  const error = result?.error

  expect(Boolean(error) || (Array.isArray(data) && data.length === 0) || data == null).toBeTruthy()
}

test.describe.serial('MarketOS Event Exhibitor Info Security', () => {
  test('SECURITY: event_exhibitor_info ist für anon und fremde Organizer gesperrt, bleibt aber für den Eigentümer bearbeitbar', async ({
    browser,
    page
  }, testInfo) => {
    const ownerProject = `${testInfo.project.name}-event-exhibitor-owner`
    const intruderProject = `${testInfo.project.name}-event-exhibitor-intruder`
    const eventTitle = buildTestEventTitle('EventExhibitorInfo')
    const initialArrivalNotes = 'PW_E2E_Anfahrt intern nur für Veranstalter'
    const updatedArrivalNotes = 'PW_E2E_Aktualisierte interne Anfahrt'

    const intruderPage = await browser.newPage()
    let ownerCredentials = null
    let intruderCredentials = null
    let ownerInfoId = null

    try {
      ownerCredentials = await ensureAuthenticated(page, ownerProject)
      intruderCredentials = await ensureAuthenticated(intruderPage, intruderProject)

      const ownerClient = await getAuthedClient(ownerCredentials)
      const intruderClient = await getAuthedClient(intruderCredentials)
      const anonClient = getAnonClient()

      const ownerEvent = await createEventRecord(ownerCredentials, {
        title: eventTitle,
        public_visible: false
      })

      const { data: insertedInfo, error: insertError } = await ownerClient
        .from('event_exhibitor_info')
        .insert({
          event_id: ownerEvent.id,
          arrival_notes: initialArrivalNotes,
          access_notes: 'Tor A hinter der Halle',
          exhibitor_contact_name: 'PW Einsatzleitung',
          exhibitor_contact_phone: '+49 000 000 000',
          emergency_contact_name: 'PW Notfallkontakt',
          emergency_contact_phone: '+49 111 111 111'
        })
        .select('id,event_id,arrival_notes,access_notes')
        .single()

      if (insertError) throw insertError
      ownerInfoId = insertedInfo.id

      const { data: ownerRead, error: ownerReadError } = await ownerClient
        .from('event_exhibitor_info')
        .select('id,event_id,arrival_notes,access_notes')
        .eq('event_id', ownerEvent.id)
        .maybeSingle()

      if (ownerReadError) throw ownerReadError
      expect(ownerRead?.id).toBe(ownerInfoId)
      expect(ownerRead?.arrival_notes).toBe(initialArrivalNotes)

      const anonRead = await anonClient
        .from('event_exhibitor_info')
        .select('id,event_id,arrival_notes')
        .eq('id', ownerInfoId)

      expectBlockedRead(anonRead)

      const intruderRead = await intruderClient
        .from('event_exhibitor_info')
        .select('id,event_id,arrival_notes')
        .eq('id', ownerInfoId)

      expectBlockedRead(intruderRead)

      const { data: ownerUpdated, error: ownerUpdateError } = await ownerClient
        .from('event_exhibitor_info')
        .update({ arrival_notes: updatedArrivalNotes })
        .eq('id', ownerInfoId)
        .select('id,arrival_notes')
        .single()

      if (ownerUpdateError) throw ownerUpdateError
      expect(ownerUpdated?.arrival_notes).toBe(updatedArrivalNotes)

      const intruderUpdate = await intruderClient
        .from('event_exhibitor_info')
        .update({ arrival_notes: 'PW_E2E_Unerlaubter Updateversuch' })
        .eq('id', ownerInfoId)
        .select('id,arrival_notes')

      expectBlockedWrite(intruderUpdate)

      const { data: ownerConfirm, error: ownerConfirmError } = await ownerClient
        .from('event_exhibitor_info')
        .select('id,arrival_notes')
        .eq('id', ownerInfoId)
        .maybeSingle()

      if (ownerConfirmError) throw ownerConfirmError
      expect(ownerConfirm?.arrival_notes).toBe(updatedArrivalNotes)

      await cleanupOwnedTestData(ownerCredentials, { eventTitles: [eventTitle] })

      const { data: cascadeCheck, error: cascadeCheckError } = await ownerClient
        .from('event_exhibitor_info')
        .select('id')
        .eq('id', ownerInfoId)

      if (cascadeCheckError) throw cascadeCheckError
      expect(cascadeCheck || []).toHaveLength(0)
    } finally {
      if (ownerCredentials) {
        await cleanupOwnedTestData(ownerCredentials, { eventTitles: [eventTitle] })
      }
      if (intruderCredentials) {
        await cleanupOwnedTestData(intruderCredentials)
      }
    }
  })
})
