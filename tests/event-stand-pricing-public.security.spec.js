import { test, expect } from '@playwright/test'
import {
  buildTestEventTitle,
  cleanupOwnedTestData,
  createEventRecord,
  ensureAuthenticated,
  getAnonClient,
  getAuthedClient,
  isStandPricingPublicSchemaReady,
  isStandPricingSchemaReady
} from './helpers/workflow'

// Felder, die NIE im Public-RPC-Ergebnis erscheinen dürfen.
const FORBIDDEN_FIELDS = ['event_id', 'public_visible', 'sort_order', 'created_at', 'updated_at']

function assertNoForbiddenFields(rows, label) {
  for (const row of rows || []) {
    for (const field of FORBIDDEN_FIELDS) {
      expect(
        Object.prototype.hasOwnProperty.call(row, field),
        `Feld "${field}" darf nicht in ${label}-Ergebnis erscheinen`
      ).toBe(false)
    }
  }
}

test.describe.serial('MarketOS Stand Pricing Public Security', () => {
  test(
    'SECURITY PUBLIC: Öffentliche Stand-Pricing-RPCs geben nur whitelisted Daten freigegebener Events aus – direkte Tabellen bleiben anon-gesperrt',
    async ({ browser, page }, testInfo) => {
      test.setTimeout(90000)

      const projectName = `${testInfo.project.name}-stand-pricing-public`
      const eventTitlePublic = buildTestEventTitle('StandPricingPublic')
      const eventTitlePrivate = buildTestEventTitle('StandPricingPrivate')

      let credentials = null
      let publicEventId = null
      let privateEventId = null

      try {
        credentials = await ensureAuthenticated(page, projectName)

        // Schema-Prüfung: Tabellen vorhanden?
        const tablesReady = await isStandPricingSchemaReady(credentials)
        expect(
          tablesReady,
          'Stand-Pricing-Tabellen fehlen. Bitte supabase/event_stand_pricing.sql ausführen.'
        ).toBeTruthy()

        // Schema-Prüfung: RPCs vorhanden?
        const rpcsReady = await isStandPricingPublicSchemaReady()
        expect(
          rpcsReady,
          'Öffentliche Stand-Pricing-RPCs fehlen. Bitte supabase/event_stand_pricing_public.sql ausführen.'
        ).toBeTruthy()

        const ownerClient = await getAuthedClient(credentials)
        const anonClient = getAnonClient()

        // ─────────────────────────────────────────────
        // Setup: Öffentliches Event + nicht-öffentliches Event anlegen
        // ─────────────────────────────────────────────

        const publicEvent = await createEventRecord(credentials, {
          title: eventTitlePublic,
          public_visible: true
        })
        publicEventId = publicEvent.id

        const privateEvent = await createEventRecord(credentials, {
          title: eventTitlePrivate,
          public_visible: false
        })
        privateEventId = privateEvent.id

        // Standoptionen für das öffentliche Event anlegen
        // Option A: public_visible=true, is_available=true → soll erscheinen
        const { data: optionPublic, error: optPublicErr } = await ownerClient
          .from('event_stand_options')
          .insert({
            event_id: publicEventId,
            label: 'PW_E2E_Außenstand Pauschale',
            area_type: 'outdoor',
            surface_types: ['wiese'],
            pricing_type: 'flat',
            price_cents: 3500,
            is_price_on_request: false,
            is_available: true,
            public_visible: true,
            sort_order: 0
          })
          .select('id')
          .single()
        if (optPublicErr) throw optPublicErr

        // Option B: public_visible=false → darf NICHT erscheinen
        const { error: optPrivateErr } = await ownerClient
          .from('event_stand_options')
          .insert({
            event_id: publicEventId,
            label: 'PW_E2E_Interne Option',
            area_type: 'indoor',
            surface_types: [],
            pricing_type: 'flat',
            price_cents: 9999,
            is_price_on_request: false,
            is_available: true,
            public_visible: false,
            sort_order: 1
          })
          .select('id')
          .single()
        if (optPrivateErr) throw optPrivateErr

        // Option C: is_available=false → darf NICHT erscheinen
        const { error: optUnavailErr } = await ownerClient
          .from('event_stand_options')
          .insert({
            event_id: publicEventId,
            label: 'PW_E2E_Nicht verfügbare Option',
            area_type: 'outdoor',
            surface_types: [],
            pricing_type: 'flat',
            price_cents: 1000,
            is_price_on_request: false,
            is_available: false,
            public_visible: true,
            sort_order: 2
          })
          .select('id')
          .single()
        if (optUnavailErr) throw optUnavailErr

        // Option D: tiered_length für Preisranges-Test + zwei Tiers
        const { data: optTiered, error: optTieredErr } = await ownerClient
          .from('event_stand_options')
          .insert({
            event_id: publicEventId,
            label: 'PW_E2E_Staffelstand',
            area_type: 'outdoor',
            surface_types: ['asphalt'],
            pricing_type: 'tiered_length',
            is_price_on_request: false,
            is_available: true,
            public_visible: true,
            sort_order: 3
          })
          .select('id')
          .single()
        if (optTieredErr) throw optTieredErr

        const { error: tier1Err } = await ownerClient
          .from('event_stand_price_tiers')
          .insert({
            stand_option_id: optTiered.id,
            label: 'PW_E2E_Bis 3m',
            min_length_m: 0,
            max_length_m: 3.0,
            price_cents: 4000,
            is_price_on_request: false,
            sort_order: 0
          })
        if (tier1Err) throw tier1Err

        const { error: tier2Err } = await ownerClient
          .from('event_stand_price_tiers')
          .insert({
            stand_option_id: optTiered.id,
            label: 'PW_E2E_Ab 3m',
            min_length_m: 3.0,
            is_price_on_request: true,
            sort_order: 1
          })
        if (tier2Err) throw tier2Err

        // Addon: public_visible=true → soll erscheinen
        const { error: addonPublicErr } = await ownerClient
          .from('event_addon_options')
          .insert({
            event_id: publicEventId,
            addon_type: 'electricity',
            label: 'PW_E2E_Stromanschluss',
            description: 'PW_E2E_16A Starkstrom',
            price_cents: 1200,
            is_price_on_request: false,
            is_available: true,
            public_visible: true,
            sort_order: 0
          })
          .select('id')
          .single()
        if (addonPublicErr) throw addonPublicErr

        // Addon: public_visible=false → darf NICHT erscheinen
        const { error: addonPrivateErr } = await ownerClient
          .from('event_addon_options')
          .insert({
            event_id: publicEventId,
            addon_type: 'water',
            label: 'PW_E2E_Internes Addon',
            price_cents: 500,
            is_price_on_request: false,
            is_available: true,
            public_visible: false,
            sort_order: 1
          })
          .select('id')
          .single()
        if (addonPrivateErr) throw addonPrivateErr

        // Standoption für das PRIVATE Event (darf nie erscheinen)
        const { error: privateOptErr } = await ownerClient
          .from('event_stand_options')
          .insert({
            event_id: privateEventId,
            label: 'PW_E2E_Option am privaten Event',
            area_type: 'indoor',
            surface_types: [],
            pricing_type: 'flat',
            price_cents: 7777,
            is_price_on_request: false,
            is_available: true,
            public_visible: true,
            sort_order: 0
          })
          .select('id')
          .single()
        if (privateOptErr) throw privateOptErr

        // ─────────────────────────────────────────────
        // SZENARIO 1: Anon-RPC auf nicht-öffentliches Event → leere Arrays
        // ─────────────────────────────────────────────

        const { data: privateOpts, error: privOptErr } = await anonClient.rpc(
          'get_public_event_stand_options',
          { p_event_id: privateEventId }
        )
        expect(privOptErr).toBeNull()
        expect(Array.isArray(privateOpts)).toBe(true)
        expect(privateOpts).toHaveLength(0)

        const { data: privateTiers, error: privTierErr } = await anonClient.rpc(
          'get_public_event_stand_price_tiers',
          { p_event_id: privateEventId }
        )
        expect(privTierErr).toBeNull()
        expect(Array.isArray(privateTiers)).toBe(true)
        expect(privateTiers).toHaveLength(0)

        const { data: privateAddons, error: privAddonErr } = await anonClient.rpc(
          'get_public_event_addon_options',
          { p_event_id: privateEventId }
        )
        expect(privAddonErr).toBeNull()
        expect(Array.isArray(privateAddons)).toBe(true)
        expect(privateAddons).toHaveLength(0)

        // ─────────────────────────────────────────────
        // SZENARIO 2: Anon-RPC auf öffentliches Event →
        //   nur public_visible=true UND is_available=true erscheinen
        // ─────────────────────────────────────────────

        const { data: publicOpts, error: pubOptErr } = await anonClient.rpc(
          'get_public_event_stand_options',
          { p_event_id: publicEventId }
        )
        expect(pubOptErr).toBeNull()
        expect(Array.isArray(publicOpts)).toBe(true)

        // Nur die beiden public+available Optionen (Pauschale + Staffel) dürfen erscheinen
        expect(publicOpts.length).toBe(2)

        const labels = publicOpts.map(o => o.label)
        expect(labels).toContain('PW_E2E_Außenstand Pauschale')
        expect(labels).toContain('PW_E2E_Staffelstand')
        // Interne Option und nicht-verfügbare Option dürfen nicht erscheinen
        expect(labels).not.toContain('PW_E2E_Interne Option')
        expect(labels).not.toContain('PW_E2E_Nicht verfügbare Option')

        // ─────────────────────────────────────────────
        // SZENARIO 3: Feldwhitelist prüfen – keine internen Felder im RPC-Ergebnis
        // ─────────────────────────────────────────────

        assertNoForbiddenFields(publicOpts, 'get_public_event_stand_options')

        // Tierpflichtfelder prüfen
        const { data: publicTiers, error: pubTierErr } = await anonClient.rpc(
          'get_public_event_stand_price_tiers',
          { p_event_id: publicEventId }
        )
        expect(pubTierErr).toBeNull()
        expect(Array.isArray(publicTiers)).toBe(true)
        expect(publicTiers.length).toBeGreaterThanOrEqual(2)

        // stand_option_id ist erlaubt (für clientseitigen Join), id darf NICHT enthalten sein
        for (const tier of publicTiers) {
          expect(Object.prototype.hasOwnProperty.call(tier, 'stand_option_id')).toBe(true)
          expect(Object.prototype.hasOwnProperty.call(tier, 'id')).toBe(false)
          expect(Object.prototype.hasOwnProperty.call(tier, 'sort_order')).toBe(false)
          expect(Object.prototype.hasOwnProperty.call(tier, 'created_at')).toBe(false)
          expect(Object.prototype.hasOwnProperty.call(tier, 'updated_at')).toBe(false)
        }

        // Tier-Inhalte prüfen
        const tierLabels = publicTiers.map(t => t.label)
        expect(tierLabels).toContain('PW_E2E_Bis 3m')
        expect(tierLabels).toContain('PW_E2E_Ab 3m')

        // Addon-Feldwhitelist
        const { data: publicAddons, error: pubAddonErr } = await anonClient.rpc(
          'get_public_event_addon_options',
          { p_event_id: publicEventId }
        )
        expect(pubAddonErr).toBeNull()
        expect(Array.isArray(publicAddons)).toBe(true)

        // Nur das public+available Addon erscheint
        expect(publicAddons.length).toBe(1)
        expect(publicAddons[0].label).toBe('PW_E2E_Stromanschluss')
        expect(publicAddons[0].addon_type).toBe('electricity')
        expect(publicAddons[0].price_cents).toBe(1200)

        assertNoForbiddenFields(publicAddons, 'get_public_event_addon_options')

        // ─────────────────────────────────────────────
        // SZENARIO 4: Preisranges – is_price_on_request korrekt übertragen
        // ─────────────────────────────────────────────

        const tieredOptionId = optTiered.id
        const tiersForTieredOption = publicTiers.filter(
          t => t.stand_option_id === tieredOptionId
        )
        expect(tiersForTieredOption.length).toBe(2)

        const tier1 = tiersForTieredOption.find(t => t.label === 'PW_E2E_Bis 3m')
        const tier2 = tiersForTieredOption.find(t => t.label === 'PW_E2E_Ab 3m')
        expect(tier1).toBeDefined()
        expect(tier1.price_cents).toBe(4000)
        expect(tier1.is_price_on_request).toBe(false)
        expect(tier2).toBeDefined()
        expect(tier2.is_price_on_request).toBe(true)

        // ─────────────────────────────────────────────
        // SZENARIO 5: Direkter anon-Tabellenzugriff bleibt weiterhin blockiert
        // ─────────────────────────────────────────────

        const directOpts = await anonClient
          .from('event_stand_options')
          .select('id,label')
          .eq('event_id', publicEventId)

        const directOptsBlocked =
          Boolean(directOpts.error) ||
          (Array.isArray(directOpts.data) && directOpts.data.length === 0) ||
          directOpts.data == null
        expect(directOptsBlocked).toBeTruthy()

        const directTiers = await anonClient
          .from('event_stand_price_tiers')
          .select('id,label')

        const directTiersBlocked =
          Boolean(directTiers.error) ||
          (Array.isArray(directTiers.data) && directTiers.data.length === 0) ||
          directTiers.data == null
        expect(directTiersBlocked).toBeTruthy()

        const directAddons = await anonClient
          .from('event_addon_options')
          .select('id,label')
          .eq('event_id', publicEventId)

        const directAddonsBlocked =
          Boolean(directAddons.error) ||
          (Array.isArray(directAddons.data) && directAddons.data.length === 0) ||
          directAddons.data == null
        expect(directAddonsBlocked).toBeTruthy()

        // ─────────────────────────────────────────────
        // SZENARIO 6: Preisdaten der privaten Option nicht öffentlich zugänglich
        // (Wert 7777 darf in keinem RPC-Ergebnis auftauchen)
        // ─────────────────────────────────────────────

        const allPublicPrices = publicOpts
          .map(o => o.price_cents)
          .filter(Boolean)
        expect(allPublicPrices).not.toContain(7777)
      } finally {
        if (credentials) {
          await cleanupOwnedTestData(credentials, {
            eventTitles: [eventTitlePublic, eventTitlePrivate]
          })
        }
      }
    }
  )
})
