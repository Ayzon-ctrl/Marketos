import { test, expect } from '@playwright/test'
import {
  buildTestEventTitle,
  cleanupOwnedTestData,
  createEventRecord,
  ensureAuthenticated,
  getAnonClient,
  getAuthedClient
} from './helpers/workflow'

// RLS-Blockierung: akzeptiert sowohl einen Fehler als auch 0 Ergebnisse.
// Beides ist eine gültige RLS-Reaktion, je nach Supabase-Version und Query-Kontext.
function expectBlockedRead(result) {
  const data = result?.data
  const error = result?.error
  expect(
    Boolean(error) || (Array.isArray(data) && data.length === 0) || data == null
  ).toBeTruthy()
}

function expectBlockedWrite(result) {
  const data = result?.data
  const error = result?.error
  expect(
    Boolean(error) || (Array.isArray(data) && data.length === 0) || data == null
  ).toBeTruthy()
}

// Prüft, ob das Stand-Pricing-Schema in der Live-DB vorhanden ist.
async function isStandPricingSchemaReady(credentials) {
  const client = await getAuthedClient(credentials)
  const checks = await Promise.all([
    client.from('event_stand_options').select('id').limit(1),
    client.from('event_stand_price_tiers').select('id').limit(1),
    client.from('event_addon_options').select('id').limit(1)
  ])
  return checks.every(result => !result.error)
}

test.describe.serial('MarketOS Stand Pricing Security', () => {
  test(
    'SECURITY: event_stand_options, event_stand_price_tiers und event_addon_options sind fuer anon und fremde Organizer gesperrt, bleiben aber fuer den Eigentuemer bearbeitbar',
    async ({ browser, page }, testInfo) => {
      test.setTimeout(60000)

      const ownerProject = `${testInfo.project.name}-stand-pricing-owner`
      const intruderProject = `${testInfo.project.name}-stand-pricing-intruder`
      const eventTitle = buildTestEventTitle('StandPricingSecurity')

      const intruderPage = await browser.newPage()
      let ownerCredentials = null
      let intruderCredentials = null
      let ownerStandOptionId = null
      let ownerPriceTierId = null
      let ownerAddonId = null
      let eventDeletedInTest = false

      try {
        ownerCredentials = await ensureAuthenticated(page, ownerProject)
        intruderCredentials = await ensureAuthenticated(intruderPage, intruderProject)

        const ownerClient = await getAuthedClient(ownerCredentials)
        const intruderClient = await getAuthedClient(intruderCredentials)
        const anonClient = getAnonClient()

        // Schema-Verfuegbarkeit sicherstellen
        const schemaReady = await isStandPricingSchemaReady(ownerCredentials)
        expect(
          schemaReady,
          'Stand-Pricing-Schema fehlt in Supabase. Bitte supabase/event_stand_pricing.sql ausfuehren.'
        ).toBeTruthy()

        // Test-Event anlegen (intern, nicht oeffentlich)
        const ownerEvent = await createEventRecord(ownerCredentials, {
          title: eventTitle,
          public_visible: false
        })

        // ---------------------------------------------------------------
        // SZENARIO 1: Organizer legt Standoption an und liest sie zurueck
        // ---------------------------------------------------------------

        const { data: insertedOption, error: insertOptionError } = await ownerClient
          .from('event_stand_options')
          .insert({
            event_id: ownerEvent.id,
            label: 'PW_E2E_Aussenstand bis 3m',
            area_type: 'outdoor',
            surface_types: ['wiese', 'erde'],
            surface_notes: 'PW_E2E_Pavillongewichte erforderlich.',
            pricing_type: 'up_to_length',
            max_length_m: 3.0,
            price_cents: 5000,
            is_available: true,
            public_visible: false,
            sort_order: 0
          })
          .select('id,event_id,label,area_type,pricing_type,price_cents')
          .single()

        if (insertOptionError) throw insertOptionError
        ownerStandOptionId = insertedOption.id

        const { data: ownerReadOption, error: ownerReadOptionError } = await ownerClient
          .from('event_stand_options')
          .select('id,event_id,label,price_cents')
          .eq('id', ownerStandOptionId)
          .maybeSingle()

        if (ownerReadOptionError) throw ownerReadOptionError
        expect(ownerReadOption?.id).toBe(ownerStandOptionId)
        expect(ownerReadOption?.price_cents).toBe(5000)

        // ---------------------------------------------------------------
        // SZENARIO 2: Organizer legt Price-Tier an und liest ihn zurueck
        // ---------------------------------------------------------------

        const { data: insertedTier, error: insertTierError } = await ownerClient
          .from('event_stand_price_tiers')
          .insert({
            stand_option_id: ownerStandOptionId,
            label: 'PW_E2E_Bis 3m Frontlaenge',
            min_length_m: 0,
            max_length_m: 3.0,
            price_cents: 5000,
            is_price_on_request: false,
            sort_order: 0
          })
          .select('id,stand_option_id,label,price_cents')
          .single()

        if (insertTierError) throw insertTierError
        ownerPriceTierId = insertedTier.id

        const { data: ownerReadTier, error: ownerReadTierError } = await ownerClient
          .from('event_stand_price_tiers')
          .select('id,stand_option_id,label,price_cents')
          .eq('id', ownerPriceTierId)
          .maybeSingle()

        if (ownerReadTierError) throw ownerReadTierError
        expect(ownerReadTier?.id).toBe(ownerPriceTierId)
        expect(ownerReadTier?.price_cents).toBe(5000)

        // ---------------------------------------------------------------
        // SZENARIO 3: Organizer legt Addon an und liest ihn zurueck
        // ---------------------------------------------------------------

        const { data: insertedAddon, error: insertAddonError } = await ownerClient
          .from('event_addon_options')
          .insert({
            event_id: ownerEvent.id,
            addon_type: 'electricity',
            label: 'PW_E2E_Stromanschluss 16A',
            description: 'PW_E2E_Stromanschluss fuer Aussteller.',
            price_cents: 1000,
            is_price_on_request: false,
            is_available: true,
            public_visible: false,
            sort_order: 0
          })
          .select('id,event_id,label,price_cents')
          .single()

        if (insertAddonError) throw insertAddonError
        ownerAddonId = insertedAddon.id

        const { data: ownerReadAddon, error: ownerReadAddonError } = await ownerClient
          .from('event_addon_options')
          .select('id,event_id,label,price_cents')
          .eq('id', ownerAddonId)
          .maybeSingle()

        if (ownerReadAddonError) throw ownerReadAddonError
        expect(ownerReadAddon?.id).toBe(ownerAddonId)
        expect(ownerReadAddon?.price_cents).toBe(1000)

        // ---------------------------------------------------------------
        // SZENARIO 4: Organizer kann eigene Daten updaten
        // ---------------------------------------------------------------

        const { data: updatedOption, error: updateOptionError } = await ownerClient
          .from('event_stand_options')
          .update({ price_cents: 5500, label: 'PW_E2E_Aussenstand bis 3m (aktualisiert)' })
          .eq('id', ownerStandOptionId)
          .select('id,label,price_cents')
          .single()

        if (updateOptionError) throw updateOptionError
        expect(updatedOption?.price_cents).toBe(5500)
        expect(updatedOption?.label).toBe('PW_E2E_Aussenstand bis 3m (aktualisiert)')

        const { data: updatedTier, error: updateTierError } = await ownerClient
          .from('event_stand_price_tiers')
          .update({ price_cents: 5500, label: 'PW_E2E_Bis 3m (aktualisiert)' })
          .eq('id', ownerPriceTierId)
          .select('id,label,price_cents')
          .single()

        if (updateTierError) throw updateTierError
        expect(updatedTier?.price_cents).toBe(5500)

        const { data: updatedAddon, error: updateAddonError } = await ownerClient
          .from('event_addon_options')
          .update({ price_cents: 1200, label: 'PW_E2E_Stromanschluss 16A (aktualisiert)' })
          .eq('id', ownerAddonId)
          .select('id,label,price_cents')
          .single()

        if (updateAddonError) throw updateAddonError
        expect(updatedAddon?.price_cents).toBe(1200)

        // ---------------------------------------------------------------
        // SZENARIO 5-7: Fremder Organizer kann nichts lesen
        // ---------------------------------------------------------------

        const intruderReadOption = await intruderClient
          .from('event_stand_options')
          .select('id,label,price_cents')
          .eq('id', ownerStandOptionId)

        expectBlockedRead(intruderReadOption)

        const intruderReadTier = await intruderClient
          .from('event_stand_price_tiers')
          .select('id,label,price_cents')
          .eq('id', ownerPriceTierId)

        expectBlockedRead(intruderReadTier)

        const intruderReadAddon = await intruderClient
          .from('event_addon_options')
          .select('id,label,price_cents')
          .eq('id', ownerAddonId)

        expectBlockedRead(intruderReadAddon)

        // ---------------------------------------------------------------
        // SZENARIO 8: Fremder Organizer kann nichts updaten
        //             Anschliessend: Eigentuemer prueft, Daten unveraendert
        // ---------------------------------------------------------------

        const intruderUpdateOption = await intruderClient
          .from('event_stand_options')
          .update({ price_cents: 99999, label: 'PW_E2E_UNERLAUBT' })
          .eq('id', ownerStandOptionId)
          .select('id,price_cents')

        expectBlockedWrite(intruderUpdateOption)

        const intruderUpdateTier = await intruderClient
          .from('event_stand_price_tiers')
          .update({ price_cents: 99999 })
          .eq('id', ownerPriceTierId)
          .select('id,price_cents')

        expectBlockedWrite(intruderUpdateTier)

        const intruderUpdateAddon = await intruderClient
          .from('event_addon_options')
          .update({ price_cents: 99999, label: 'PW_E2E_UNERLAUBT' })
          .eq('id', ownerAddonId)
          .select('id,price_cents')

        expectBlockedWrite(intruderUpdateAddon)

        // Eigentuemer bestaetigt: Werte unveraendert
        const { data: confirmOption, error: confirmOptionError } = await ownerClient
          .from('event_stand_options')
          .select('id,price_cents,label')
          .eq('id', ownerStandOptionId)
          .maybeSingle()

        if (confirmOptionError) throw confirmOptionError
        expect(confirmOption?.price_cents).toBe(5500)
        expect(confirmOption?.label).toBe('PW_E2E_Aussenstand bis 3m (aktualisiert)')

        const { data: confirmTier, error: confirmTierError } = await ownerClient
          .from('event_stand_price_tiers')
          .select('id,price_cents')
          .eq('id', ownerPriceTierId)
          .maybeSingle()

        if (confirmTierError) throw confirmTierError
        expect(confirmTier?.price_cents).toBe(5500)

        const { data: confirmAddon, error: confirmAddonError } = await ownerClient
          .from('event_addon_options')
          .select('id,price_cents')
          .eq('id', ownerAddonId)
          .maybeSingle()

        if (confirmAddonError) throw confirmAddonError
        expect(confirmAddon?.price_cents).toBe(1200)

        // ---------------------------------------------------------------
        // SZENARIO 9: Anon kann nichts lesen
        // ---------------------------------------------------------------

        const anonReadOption = await anonClient
          .from('event_stand_options')
          .select('id,label')
          .eq('id', ownerStandOptionId)

        expectBlockedRead(anonReadOption)

        const anonReadTier = await anonClient
          .from('event_stand_price_tiers')
          .select('id,label')
          .eq('id', ownerPriceTierId)

        expectBlockedRead(anonReadTier)

        const anonReadAddon = await anonClient
          .from('event_addon_options')
          .select('id,label')
          .eq('id', ownerAddonId)

        expectBlockedRead(anonReadAddon)

        // ---------------------------------------------------------------
        // SZENARIO 10: Cascade – Event loeschen entfernt alle abhaengigen Daten
        //
        // Hinweis: Nach dem Loeschen des Events greift auch RLS nicht mehr,
        // da der EXISTS-Check in der Policy kein Event mehr findet.
        // Das Ergebnis (0 rows) beweist in Kombination:
        //   a) Die Zeilen sind per ON DELETE CASCADE geloescht worden, ODER
        //   b) RLS blockiert den Zugriff, weil kein Event mehr existiert.
        // Beides ist das korrekte, gewuenschte Verhalten.
        // ---------------------------------------------------------------

        await cleanupOwnedTestData(ownerCredentials, { eventTitles: [eventTitle] })
        eventDeletedInTest = true

        const { data: cascadeOption, error: cascadeOptionError } = await ownerClient
          .from('event_stand_options')
          .select('id')
          .eq('id', ownerStandOptionId)

        if (cascadeOptionError) throw cascadeOptionError
        expect(cascadeOption || []).toHaveLength(0)

        const { data: cascadeTier, error: cascadeTierError } = await ownerClient
          .from('event_stand_price_tiers')
          .select('id')
          .eq('id', ownerPriceTierId)

        if (cascadeTierError) throw cascadeTierError
        expect(cascadeTier || []).toHaveLength(0)

        const { data: cascadeAddon, error: cascadeAddonError } = await ownerClient
          .from('event_addon_options')
          .select('id')
          .eq('id', ownerAddonId)

        if (cascadeAddonError) throw cascadeAddonError
        expect(cascadeAddon || []).toHaveLength(0)
      } finally {
        // Cleanup: Event wird nur nochmal geloescht, falls es noch nicht im Test geloescht wurde.
        if (ownerCredentials && !eventDeletedInTest) {
          await cleanupOwnedTestData(ownerCredentials, { eventTitles: [eventTitle] })
        }
        if (intruderCredentials) {
          await cleanupOwnedTestData(intruderCredentials)
        }
      }
    }
  )
})
