import { test, expect } from '@playwright/test'
import {
  ensureAuthenticated,
  getAnonClient,
  getAuthedClient,
} from './helpers/workflow'

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Prueft ob get_analytics_summary in der Live-DB vorhanden ist.
 * Kriterium: Aufruf moeglich ohne PGRST202 (Funktion nicht im Schema-Cache).
 */
async function isAnalyticsSummaryReady(credentials) {
  const client = await getAuthedClient(credentials)
  const { error } = await client.rpc('get_analytics_summary', {
    p_days:         1,
    p_area:         null,
    p_role_context: null,
    p_environment:  'development',
  })
  if (error && (error.code === 'PGRST202' || /does not exist/i.test(error.message))) return false
  return true
}

/**
 * Schreibt ein Test-Event ueber track_event und gibt die session_id zurueck.
 */
async function writeTestEvent(client, overrides = {}) {
  const sessionId = crypto.randomUUID()
  await client.rpc('track_event', {
    p_event_name:   overrides.event_name   ?? 'app_entry',
    p_area:         overrides.area         ?? 'dashboard',
    p_role_context: overrides.role_context ?? null,
    p_session_id:   sessionId,
    p_environment:  overrides.environment  ?? 'development',
  })
  return sessionId
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.serial('MarketOS Analytics Summary RPC', () => {
  let credentials = null
  let client = null

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    credentials = await ensureAuthenticated(page, 'analytics-summary')
    client = await getAuthedClient(credentials)
    await page.close()
  })

  // -------------------------------------------------------------------------
  // TEST 1: Schema-Guard
  // Faellt klar aus wenn analytics_summary.sql noch nicht ausgefuehrt wurde.
  // -------------------------------------------------------------------------

  test('SCHEMA: analytics_summary.sql muss in Supabase ausgefuehrt worden sein', async () => {
    const ready = await isAnalyticsSummaryReady(credentials)
    expect(
      ready,
      'Analytics-Summary-Schema fehlt. Bitte supabase/analytics_summary.sql im Supabase SQL Editor ausfuehren.'
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 2: Authentifizierter Aufruf gibt valides Array-Format zurueck
  // -------------------------------------------------------------------------

  test('RPC: get_analytics_summary gibt ein Array zurueck', async () => {
    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:        30,
      p_environment: 'development',
    })

    expect(error, `get_analytics_summary RPC schlug fehl: ${error?.message}`).toBeNull()
    expect(Array.isArray(data)).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 3: Ausgabe enthaelt genau die erwarteten Spalten
  // Keine user_id, session_id oder entity_id in der Ausgabe.
  // -------------------------------------------------------------------------

  test('RPC: Ausgabe enthaelt erlaubte Spalten und KEINE personenbezogenen Felder', async () => {
    // Mindestens eine Zeile sicherstellen.
    await writeTestEvent(client, { event_name: 'app_entry', area: 'dashboard' })

    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:        1,
      p_environment: 'development',
    })

    expect(error).toBeNull()
    expect(Array.isArray(data) && data.length > 0).toBeTruthy()

    const row = data[0]

    // Erlaubte Spalten muessen vorhanden sein.
    expect(row).toHaveProperty('day')
    expect(row).toHaveProperty('area')
    expect(row).toHaveProperty('event_name')
    expect(row).toHaveProperty('event_count')
    expect('role_context' in row).toBeTruthy()   // darf auch null sein
    expect(row).toHaveProperty('environment')

    // Verbotene Spalten duerfen NICHT vorhanden sein.
    expect(row).not.toHaveProperty('user_id')
    expect(row).not.toHaveProperty('session_id')
    expect(row).not.toHaveProperty('entity_id')
    expect(row).not.toHaveProperty('entity_type')
    expect(row).not.toHaveProperty('route')
    expect(row).not.toHaveProperty('metadata')
    expect(row).not.toHaveProperty('result')
  })

  // -------------------------------------------------------------------------
  // TEST 4: event_count ist immer >= 1
  // Eine Zeile mit Count 0 darf nie zurueckgegeben werden.
  // -------------------------------------------------------------------------

  test('RPC: event_count ist in jeder Zeile >= 1', async () => {
    await writeTestEvent(client)

    const { data } = await client.rpc('get_analytics_summary', {
      p_days:        30,
      p_environment: 'development',
    })

    for (const row of data ?? []) {
      expect(
        Number(row.event_count),
        `event_count muss >= 1 sein, war: ${row.event_count}`
      ).toBeGreaterThanOrEqual(1)
    }
  })

  // -------------------------------------------------------------------------
  // TEST 5: p_area Filter gibt nur Events des angegebenen Bereichs zurueck
  // -------------------------------------------------------------------------

  test('RPC: p_area Filter beschraenkt Ausgabe auf den angegebenen Bereich', async () => {
    await writeTestEvent(client, { event_name: 'import_completed', area: 'events' })

    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:        1,
      p_area:        'events',
      p_environment: 'development',
    })

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBeTruthy()

    for (const row of data ?? []) {
      expect(
        row.area,
        `p_area='events' gesetzt, aber area='${row.area}' erhalten`
      ).toBe('events')
    }
  })

  // -------------------------------------------------------------------------
  // TEST 6: p_role_context Filter gibt nur Events der angegebenen Rolle zurueck
  // -------------------------------------------------------------------------

  test('RPC: p_role_context Filter beschraenkt Ausgabe auf die angegebene Rolle', async () => {
    await writeTestEvent(client, {
      event_name:   'import_completed',
      area:         'events',
      role_context: 'organizer',
    })

    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:         1,
      p_role_context: 'organizer',
      p_environment:  'development',
    })

    expect(error).toBeNull()
    for (const row of data ?? []) {
      expect(
        row.role_context,
        `p_role_context='organizer' gesetzt, aber role_context='${row.role_context}' erhalten`
      ).toBe('organizer')
    }
  })

  // -------------------------------------------------------------------------
  // TEST 7: p_environment trennt development von production
  //
  // Strategie: Wir schreiben ein dev-Event in einem speziellen Bereich
  // ('schema_check'), der in production nie existiert, und pruefen dass
  // eine production-Abfrage fuer diesen Bereich leer ist.
  // -------------------------------------------------------------------------

  test('RPC: p_environment=production gibt keine development-Events zurueck', async () => {
    // Dev-Event mit einem bereichs-Wert schreiben, der in production nie vorkommt.
    await writeTestEvent(client, {
      event_name:  'app_entry',
      area:        'schema_check',
      environment: 'development',
    })

    // Production-Abfrage fuer denselben Bereich – muss leer sein.
    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:        1,
      p_area:        'schema_check',
      p_environment: 'production',
    })

    expect(error).toBeNull()
    expect(
      Array.isArray(data) && data.length === 0,
      'p_environment=production darf keine development-Events enthalten'
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 8: environment-Spalte stimmt mit p_environment ueberein
  // Jede Zeile in der Ausgabe muss die angeforderte Umgebung tragen.
  // -------------------------------------------------------------------------

  test('RPC: environment-Spalte in jeder Zeile stimmt mit p_environment ueberein', async () => {
    await writeTestEvent(client, { event_name: 'app_entry', area: 'dashboard' })

    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:        1,
      p_environment: 'development',
    })

    expect(error).toBeNull()
    for (const row of data ?? []) {
      expect(
        row.environment,
        `Alle Zeilen sollen environment='development' haben, gefunden: '${row.environment}'`
      ).toBe('development')
    }
  })

  // -------------------------------------------------------------------------
  // TEST 9: p_days negativer Wert wird auf 1 gecappt (kein Fehler)
  // -------------------------------------------------------------------------

  test('RPC: p_days=-10 wird auf 1 gecappt und gibt kein Fehler zurueck', async () => {
    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:        -10,
      p_environment: 'development',
    })

    expect(error, `Fehler bei p_days=-10: ${error?.message}`).toBeNull()
    expect(Array.isArray(data)).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 10: p_days > 365 wird auf 365 gecappt (kein Fehler)
  // -------------------------------------------------------------------------

  test('RPC: p_days=9999 wird auf 365 gecappt und gibt kein Fehler zurueck', async () => {
    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:        9999,
      p_environment: 'development',
    })

    expect(error, `Fehler bei p_days=9999: ${error?.message}`).toBeNull()
    expect(Array.isArray(data)).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 11: Anon-Client erhaelt keine Daten
  //
  // Supabase kann SECURITY DEFINER-Funktionen trotz REVOKE FROM public
  // fuer anon aufrufbar lassen (Supabase-spezifisches Verhalten).
  // Die Sicherheitsgarantie liegt daher in auth.uid() IS NULL → return.
  // Erwartet: leeres Array oder Fehler – aber keine Daten.
  // -------------------------------------------------------------------------

  test('RPC: Anon-Aufruf von get_analytics_summary gibt keine Daten zurueck', async () => {
    const anonClient = getAnonClient()

    const { data, error } = await anonClient.rpc('get_analytics_summary', {
      p_days:        30,
      p_environment: 'development',
    })

    const isBlocked =
      Boolean(error) ||
      (Array.isArray(data) && data.length === 0) ||
      data == null

    expect(
      isBlocked,
      'Anon-Aufruf von get_analytics_summary darf keine Zeilen zurueckgeben'
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 12: Aggregation ist korrekt – COUNT stimmt mit bekannten Test-Events
  //
  // Wir schreiben 3 identische Events (gleiche Dimensionen) und pruefen,
  // dass event_count fuer diese Kombination mindestens 3 betraegt.
  // "Mindestens" weil vorherige Test-Runs weitere Events hinterlassen haben koennen.
  // -------------------------------------------------------------------------

  test('RPC: event_count aggregiert korrekt – mindestens 3 nach 3 identischen Writes', async () => {
    // Einzigartiger role_context-Wert 'exhibitor' als Trennmerkmal.
    // (Andere Tests schreiben 'organizer' oder null.)
    await writeTestEvent(client, { event_name: 'app_entry', area: 'dashboard', role_context: 'exhibitor' })
    await writeTestEvent(client, { event_name: 'app_entry', area: 'dashboard', role_context: 'exhibitor' })
    await writeTestEvent(client, { event_name: 'app_entry', area: 'dashboard', role_context: 'exhibitor' })

    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:         1,
      p_area:         'dashboard',
      p_role_context: 'exhibitor',
      p_environment:  'development',
    })

    expect(error).toBeNull()
    expect(Array.isArray(data) && data.length > 0).toBeTruthy()

    const appEntryRow = data?.find(r => r.event_name === 'app_entry')
    expect(
      appEntryRow,
      'Kein app_entry-Eintrag fuer role_context=exhibitor gefunden'
    ).toBeDefined()
    expect(
      Number(appEntryRow?.event_count),
      `event_count soll >= 3 sein, war: ${appEntryRow?.event_count}`
    ).toBeGreaterThanOrEqual(3)
  })

  // -------------------------------------------------------------------------
  // TEST 13: day-Spalte ist ein gueltiges Datums-Format (YYYY-MM-DD)
  // -------------------------------------------------------------------------

  test('RPC: day-Spalte enthaelt ein gueltiges Datum im Format YYYY-MM-DD', async () => {
    await writeTestEvent(client)

    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:        1,
      p_environment: 'development',
    })

    expect(error).toBeNull()
    expect(Array.isArray(data) && data.length > 0).toBeTruthy()

    for (const row of data ?? []) {
      // day kommt als String im Format 'YYYY-MM-DD' oder als Date-Objekt.
      const dayStr = typeof row.day === 'string' ? row.day : row.day?.toISOString?.()?.slice(0, 10)
      expect(
        /^\d{4}-\d{2}-\d{2}/.test(dayStr ?? ''),
        `day hat ungueltiges Format: ${row.day}`
      ).toBeTruthy()
    }
  })

  // -------------------------------------------------------------------------
  // TEST 14: Kombination p_area + p_role_context filtert korrekt
  // -------------------------------------------------------------------------

  test('RPC: Kombination p_area + p_role_context filtert korrekt', async () => {
    // Event schreiben das NICHT in den kombinierten Filter passt.
    await writeTestEvent(client, {
      event_name:   'dashboard_loaded',
      area:         'dashboard',
      role_context: 'visitor',
    })
    // Event schreiben das IN den kombinierten Filter passt.
    await writeTestEvent(client, {
      event_name:   'event_saved',
      area:         'events',
      role_context: 'organizer',
    })

    const { data, error } = await client.rpc('get_analytics_summary', {
      p_days:         1,
      p_area:         'events',
      p_role_context: 'organizer',
      p_environment:  'development',
    })

    expect(error).toBeNull()
    for (const row of data ?? []) {
      expect(row.area).toBe('events')
      expect(row.role_context).toBe('organizer')
    }
  })
})
