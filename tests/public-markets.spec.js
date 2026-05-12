import { test, expect } from '@playwright/test'
import {
  buildTestEventTitle,
  cleanupOwnedTestData,
  createEventRecord,
  ensureAuthenticated,
  getAuthedClient,
  isStandPricingPublicSchemaReady,
  isStandPricingSchemaReady
} from './helpers/workflow'

test.describe('MarketOS Public Markets', () => {
  test('PUBLIC MARKETS: Öffentliche Märkte-Seite lädt mobilfreundlich und zeigt Zustand klar an', async ({ page }) => {
    await page.goto('/markets')
    await expect(page.getByTestId('public-markets-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Märkte & Events/i })).toBeVisible()

    await expect(
      page.locator('[data-testid="public-market-card"], [data-testid="public-page-empty"], [data-testid="public-page-error"]').first()
    ).toBeVisible()
  })

  test('STANDFLÄCHEN ÖFFENTLICH: Freigegebene Standoptionen und Zusatzoptionen erscheinen auf der Public Market Detail Seite', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Kernflow wird auf Desktop geprüft.')
    test.setTimeout(90000)

    const projectName = `${testInfo.project.name}-stand-pricing-public-page`
    const eventTitleWithStands = buildTestEventTitle('StandPricingPublicPage')
    const eventTitleNoStands = buildTestEventTitle('StandPricingPublicEmpty')

    let credentials = null

    try {
      credentials = await ensureAuthenticated(page, projectName)

      // Schema-Prüfung
      const tablesReady = await isStandPricingSchemaReady(credentials)
      expect(
        tablesReady,
        'Stand-Pricing-Tabellen fehlen. Bitte supabase/event_stand_pricing.sql ausführen.'
      ).toBeTruthy()

      const rpcsReady = await isStandPricingPublicSchemaReady()
      expect(
        rpcsReady,
        'Öffentliche Stand-Pricing-RPCs fehlen. Bitte supabase/event_stand_pricing_public.sql ausführen.'
      ).toBeTruthy()

      const ownerClient = await getAuthedClient(credentials)

      // ─── Event MIT Standoptionen anlegen ───────────────────────────
      const eventWithStands = await createEventRecord(credentials, {
        title: eventTitleWithStands,
        public_visible: true
      })

      // Standoption A: flat, public_visible=true → soll erscheinen
      const { data: optFlat, error: optFlatErr } = await ownerClient
        .from('event_stand_options')
        .insert({
          event_id: eventWithStands.id,
          label: 'PW_E2E_Außenstand 3m Pauschale',
          area_type: 'outdoor',
          surface_types: ['wiese', 'erde'],
          surface_notes: 'PW_E2E_Pavillongewichte erforderlich',
          pricing_type: 'flat',
          price_cents: 4500,
          is_price_on_request: false,
          is_available: true,
          public_visible: true,
          sort_order: 0
        })
        .select('id')
        .single()
      if (optFlatErr) throw optFlatErr

      // Standoption B: tiered_length, public_visible=true → soll mit Preisranges erscheinen
      const { data: optTiered, error: optTieredErr } = await ownerClient
        .from('event_stand_options')
        .insert({
          event_id: eventWithStands.id,
          label: 'PW_E2E_Staffelstand Frontlänge',
          area_type: 'both',
          surface_types: ['asphalt'],
          pricing_type: 'tiered_length',
          is_price_on_request: false,
          is_available: true,
          public_visible: true,
          sort_order: 1
        })
        .select('id')
        .single()
      if (optTieredErr) throw optTieredErr

      // Tier 1: 0–3m = 4000ct
      const { error: tier1Err } = await ownerClient
        .from('event_stand_price_tiers')
        .insert({
          stand_option_id: optTiered.id,
          label: 'PW_E2E_Bis 3m Frontlänge',
          min_length_m: 0,
          max_length_m: 3.0,
          price_cents: 4000,
          is_price_on_request: false,
          sort_order: 0
        })
      if (tier1Err) throw tier1Err

      // Tier 2: ab 3m = Preis auf Anfrage
      const { error: tier2Err } = await ownerClient
        .from('event_stand_price_tiers')
        .insert({
          stand_option_id: optTiered.id,
          label: 'PW_E2E_Ab 3m Frontlänge',
          min_length_m: 3.0,
          is_price_on_request: true,
          sort_order: 1
        })
      if (tier2Err) throw tier2Err

      // Standoption C: public_visible=false → darf NICHT erscheinen
      const { error: optPrivErr } = await ownerClient
        .from('event_stand_options')
        .insert({
          event_id: eventWithStands.id,
          label: 'PW_E2E_Interne Standoption',
          area_type: 'indoor',
          surface_types: [],
          pricing_type: 'flat',
          price_cents: 9999,
          is_price_on_request: false,
          is_available: true,
          public_visible: false,
          sort_order: 2
        })
        .select('id')
        .single()
      if (optPrivErr) throw optPrivErr

      // Standoption D: is_available=false → darf NICHT erscheinen
      const { error: optUnavailErr } = await ownerClient
        .from('event_stand_options')
        .insert({
          event_id: eventWithStands.id,
          label: 'PW_E2E_Ausgebuchte Option',
          area_type: 'outdoor',
          surface_types: [],
          pricing_type: 'flat',
          price_cents: 1111,
          is_price_on_request: false,
          is_available: false,
          public_visible: true,
          sort_order: 3
        })
        .select('id')
        .single()
      if (optUnavailErr) throw optUnavailErr

      // Addon: Strom, public_visible=true → soll erscheinen
      const { error: addonPublicErr } = await ownerClient
        .from('event_addon_options')
        .insert({
          event_id: eventWithStands.id,
          addon_type: 'electricity',
          label: 'PW_E2E_Stromanschluss 16A',
          description: 'PW_E2E_Starkstrom für Aussteller',
          price_cents: 1000,
          is_price_on_request: false,
          is_available: true,
          public_visible: true,
          sort_order: 0
        })
        .select('id')
        .single()
      if (addonPublicErr) throw addonPublicErr

      // Addon: Wasser, public_visible=false → darf NICHT erscheinen
      const { error: addonPrivErr } = await ownerClient
        .from('event_addon_options')
        .insert({
          event_id: eventWithStands.id,
          addon_type: 'water',
          label: 'PW_E2E_Interner Wasseranschluss',
          price_cents: 500,
          is_price_on_request: false,
          is_available: true,
          public_visible: false,
          sort_order: 1
        })
        .select('id')
        .single()
      if (addonPrivErr) throw addonPrivErr

      // ─── Event OHNE Standoptionen anlegen ───────────────────────────
      const eventNoStands = await createEventRecord(credentials, {
        title: eventTitleNoStands,
        public_visible: true
      })

      // ─────────────────────────────────────────────────────────────────
      // TEST A: Event MIT Standoptionen → Sektion erscheint
      // ─────────────────────────────────────────────────────────────────

      await page.goto(`/markets/${eventWithStands.id}`)
      await expect(page.getByTestId('public-market-detail-page')).toBeVisible()

      // Sektion "Standflächen & Preise" soll erscheinen
      const pricingSection = page.getByTestId('public-stand-pricing-section')
      await expect(pricingSection).toBeVisible()

      // Pauschale Standoption sichtbar
      const flatOption = pricingSection.getByTestId('public-stand-pricing-option').filter({
        hasText: 'PW_E2E_Außenstand 3m Pauschale'
      })
      await expect(flatOption).toBeVisible()

      // Pauschalpreis korrekt: 4500ct = 45,00 €
      await expect(
        pricingSection.getByTestId('public-stand-pricing-price').filter({ hasText: '45,00 €' })
      ).toBeVisible()

      // Staffelstand sichtbar
      const tieredOption = pricingSection.getByTestId('public-stand-pricing-option').filter({
        hasText: 'PW_E2E_Staffelstand Frontlänge'
      })
      await expect(tieredOption).toBeVisible()

      // Preisrange Tier 1: 40,00 €
      await expect(
        pricingSection.getByTestId('public-stand-pricing-tier').filter({ hasText: '40,00 €' })
      ).toBeVisible()

      // Preisrange Tier 2: Preis auf Anfrage
      await expect(
        pricingSection.getByTestId('public-stand-pricing-tier').filter({ hasText: 'Preis auf Anfrage' })
      ).toBeVisible()

      // Stromanschluss-Addon sichtbar mit Preis
      const electricityAddon = pricingSection.getByTestId('public-stand-pricing-addon').filter({
        hasText: 'PW_E2E_Stromanschluss 16A'
      })
      await expect(electricityAddon).toBeVisible()
      await expect(
        electricityAddon.getByTestId('public-stand-pricing-addon-price')
      ).toContainText('10,00 €')

      // Nicht öffentliche Option darf NICHT sichtbar sein
      await expect(pricingSection.getByText('PW_E2E_Interne Standoption')).not.toBeVisible()

      // Nicht verfügbare Option darf NICHT sichtbar sein
      await expect(pricingSection.getByText('PW_E2E_Ausgebuchte Option')).not.toBeVisible()

      // Nicht öffentliches Addon darf NICHT sichtbar sein
      await expect(pricingSection.getByText('PW_E2E_Interner Wasseranschluss')).not.toBeVisible()

      // Interne Felder dürfen nicht im sichtbaren DOM erscheinen
      await expect(pricingSection.getByText('public_visible')).not.toBeVisible()
      await expect(pricingSection.getByText('sort_order')).not.toBeVisible()
      await expect(pricingSection.getByText('event_id')).not.toBeVisible()
      await expect(pricingSection.getByText('created_at')).not.toBeVisible()

      // ─────────────────────────────────────────────────────────────────
      // TEST B: Event OHNE Standoptionen → Sektion erscheint NICHT
      // ─────────────────────────────────────────────────────────────────

      await page.goto(`/markets/${eventNoStands.id}`)
      await expect(page.getByTestId('public-market-detail-page')).toBeVisible()

      // Sektion soll NICHT erscheinen wenn keine public Standoptionen vorhanden
      await expect(page.getByTestId('public-stand-pricing-section')).not.toBeVisible()
    } finally {
      if (credentials) {
        await cleanupOwnedTestData(credentials, {
          eventTitles: [eventTitleWithStands, eventTitleNoStands]
        })
      }
    }
  })
})
