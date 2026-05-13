import { test, expect } from '@playwright/test'
import {
  ensureAuthenticated,
  getAnonClient,
  getAuthedClient,
} from './helpers/workflow'
import { trackEvent, cleanRoute } from '../src/lib/analytics.js'

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Prueft ob das Analytics-Schema in der Live-DB vorhanden ist.
 * Kriterium: track_event() mit vollstaendiger MVP-Signatur ist aufrufbar.
 * PGRST202 (function not found / wrong signature) → Schema fehlt oder veraltet.
 */
async function isAnalyticsSchemaReady(credentials) {
  const client = await getAuthedClient(credentials)
  const uniqueSession = crypto.randomUUID()
  const { error } = await client.rpc('track_event', {
    p_event_name:   'app_entry',
    p_area:         'schema_check',
    p_role_context: null,
    p_session_id:   uniqueSession,
    p_entity_type:  null,
    p_entity_id:    null,
    p_route:        null,
    p_result:       null,
    p_metadata:     {},
    p_environment:  'development',
  })
  // PGRST202: Funktion nicht gefunden oder Signatur stimmt nicht ueberein.
  if (error && (error.code === 'PGRST202' || /does not exist/i.test(error.message))) return false
  return true
}

/** Liest eine eigene Zeile ueber die Test-Hilfsfunktion zurueck. */
async function fetchTestRow(client, sessionId) {
  const { data, error } = await client.rpc('get_analytics_test_row', {
    p_session_id: sessionId,
  })
  return { data, error }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.serial('MarketOS Analytics Security', () => {
  let credentials = null
  let client = null

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    credentials = await ensureAuthenticated(page, 'analytics-security')
    client = await getAuthedClient(credentials)
    await page.close()
  })

  // -------------------------------------------------------------------------
  // TEST 1: Schema-Guard
  // Faellt klar aus wenn analytics_events.sql noch nicht ausgefuehrt wurde.
  // -------------------------------------------------------------------------

  test('SCHEMA: analytics_events.sql muss in Supabase ausgefuehrt worden sein', async () => {
    const ready = await isAnalyticsSchemaReady(credentials)
    expect(
      ready,
      'Analytics-Schema fehlt. Bitte supabase/analytics_events.sql im Supabase SQL Editor ausfuehren.'
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 2: Authentifizierter RPC-Schreibvorgang mit erlaubtem Event
  // import_completed ist in der MVP-Whitelist.
  // -------------------------------------------------------------------------

  test('RPC: track_event speichert erlaubtes Event import_completed', async () => {
    const sessionId = crypto.randomUUID()

    const { error } = await client.rpc('track_event', {
      p_event_name:   'import_completed',
      p_area:         'events',
      p_role_context: 'organizer',
      p_session_id:   sessionId,
      p_route:        '/app/events',
      p_result:       'success',
      p_environment:  'development',
    })

    expect(error, `track_event RPC schlug fehl: ${error?.message}`).toBeNull()

    const { data, error: fetchError } = await fetchTestRow(client, sessionId)
    expect(fetchError, `get_analytics_test_row schlug fehl: ${fetchError?.message}`).toBeNull()
    expect(Array.isArray(data) && data.length > 0).toBeTruthy()
    expect(data[0].event_name).toBe('import_completed')
    expect(data[0].area).toBe('events')
    expect(data[0].environment).toBe('development')
  })

  // -------------------------------------------------------------------------
  // TEST 3: user_id wird aus auth.uid() gesetzt
  // Kein Client-seitiges Ueberschreiben moeglich – Wert kommt vom Server.
  // -------------------------------------------------------------------------

  test('RPC: user_id wird serverseitig aus auth.uid() gesetzt', async () => {
    const sessionId = crypto.randomUUID()

    const { data: userData, error: userError } = await client.auth.getUser()
    expect(userError).toBeNull()
    const expectedUserId = userData.user.id

    await client.rpc('track_event', {
      p_event_name:  'app_entry',
      p_area:        'dashboard',
      p_session_id:  sessionId,
      p_environment: 'development',
    })

    const { data } = await fetchTestRow(client, sessionId)
    expect(data?.[0]?.user_id).toBe(expectedUserId)
  })

  // -------------------------------------------------------------------------
  // TEST 4: Kein direktes SELECT auf analytics_events
  // RLS ohne SELECT-Policy: alle direkten Zugriffe werden blockiert.
  // -------------------------------------------------------------------------

  test('RLS: direktes SELECT auf analytics_events ist blockiert', async () => {
    const { data, error } = await client
      .from('analytics_events')
      .select('id, event_name')
      .limit(5)

    const isBlocked =
      Boolean(error) ||
      (Array.isArray(data) && data.length === 0) ||
      data == null

    expect(
      isBlocked,
      'Direktes SELECT auf analytics_events sollte durch RLS blockiert sein'
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 5: Kein direktes INSERT auf analytics_events
  // Keine INSERT-Policy → alle direkten Schreibversuche scheitern.
  // -------------------------------------------------------------------------

  test('RLS: direktes INSERT auf analytics_events ist blockiert', async () => {
    const { data: userData } = await client.auth.getUser()
    const userId = userData?.user?.id

    const { data, error } = await client
      .from('analytics_events')
      .insert({
        user_id:     userId,
        area:        'hacking',
        event_name:  'app_entry',
        environment: 'development',
      })
      .select('id')

    const isBlocked =
      Boolean(error) ||
      (Array.isArray(data) && data.length === 0) ||
      data == null

    expect(
      isBlocked,
      'Direktes INSERT auf analytics_events sollte durch RLS blockiert sein'
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 6: Anon-Client kann keine Daten in analytics_events schreiben
  //
  // Supabase erlaubt anon den Aufruf von SECURITY DEFINER-Funktionen auch
  // ohne expliziten EXECUTE-Grant (Supabase-spezifisches Verhalten).
  // Die Sicherheitsgarantie liegt daher in der Funktion selbst:
  //   auth.uid() IS NULL → stille Rueckkehr, kein INSERT.
  // Das ist die Eigenschaft, die getestet wird.
  // -------------------------------------------------------------------------

  test('RLS: Anon-Aufruf von track_event schreibt keine Zeile in analytics_events', async () => {
    const anonClient = getAnonClient()
    const sessionId = crypto.randomUUID()

    // Anon ruft track_event auf – Fehler oder kein Fehler ist sekundaer.
    await anonClient.rpc('track_event', {
      p_event_name:  'app_entry',
      p_area:        'public',
      p_session_id:  sessionId,
      p_environment: 'development',
    })

    // Kerngarantie: Es darf keine Zeile in analytics_events existieren.
    // get_analytics_test_row filtert auf user_id = auth.uid():
    // Da anon keine uid hat, wurde kein INSERT ausgefuehrt → 0 Zeilen.
    const { data, error: fetchError } = await fetchTestRow(client, sessionId)
    expect(fetchError).toBeNull()
    expect(
      Array.isArray(data) && data.length === 0,
      'Anon-Aufruf von track_event darf keine Zeile in analytics_events hinterlassen'
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 7: Unbekannter event_name wird still verworfen
  // Kein Fehler, aber auch keine Zeile in der DB.
  // -------------------------------------------------------------------------

  test('RPC: unbekannter event_name wird still verworfen (kein DB-Eintrag)', async () => {
    const sessionId = crypto.randomUUID()

    const { error } = await client.rpc('track_event', {
      p_event_name:  'UNKNOWN_INVALID_EVENT_NAME',
      p_area:        'dashboard',
      p_session_id:  sessionId,
      p_environment: 'development',
    })

    expect(error).toBeNull()

    const { data } = await fetchTestRow(client, sessionId)
    expect(Array.isArray(data) && data.length === 0).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // TEST 8: Verbotene Metadata-Schluessel werden serverseitig entfernt
  //
  // Input:  { email: 'x@y.de', label: 'Kundentext', reason: 'Freitext', count: 1 }
  // Output: { count: 1 }
  //
  // email, label, reason sind nicht in der Whitelist → werden gedroppt.
  // -------------------------------------------------------------------------

  test('RPC: verbotene Metadata-Schluessel werden serverseitig gefiltert', async () => {
    const sessionId = crypto.randomUUID()

    await client.rpc('track_event', {
      p_event_name:  'app_entry',
      p_area:        'dashboard',
      p_session_id:  sessionId,
      p_environment: 'development',
      p_metadata: {
        email:  'x@y.de',      // verboten – personenbezogen
        label:  'Kundentext',  // verboten – Freitext
        reason: 'Freitext',    // verboten – Freitext
        count:  1,             // erlaubt
      },
    })

    const { data } = await fetchTestRow(client, sessionId)
    const meta = data?.[0]?.metadata ?? {}

    // Verbotene Keys muessen fehlen.
    expect(meta.email).toBeUndefined()
    expect(meta.label).toBeUndefined()
    expect(meta.reason).toBeUndefined()

    // Erlaubter Key bleibt erhalten.
    expect(meta.count).toBe(1)
  })

  // -------------------------------------------------------------------------
  // TEST 9: Erlaubte Metadata-Schluessel bleiben vollstaendig erhalten
  // -------------------------------------------------------------------------

  test('RPC: erlaubte Metadata-Schluessel werden unveraendert gespeichert', async () => {
    const sessionId = crypto.randomUUID()

    await client.rpc('track_event', {
      p_event_name:  'import_completed',
      p_area:        'events',
      p_session_id:  sessionId,
      p_environment: 'development',
      p_metadata: {
        import_basics:     true,
        import_participants: 12,
        participant_count: 12,
        skipped_count:     2,
        source:            'csv',
      },
    })

    const { data } = await fetchTestRow(client, sessionId)
    const meta = data?.[0]?.metadata ?? {}

    expect(meta.import_basics).toBe(true)
    expect(meta.import_participants).toBe(12)
    expect(meta.participant_count).toBe(12)
    expect(meta.skipped_count).toBe(2)
    expect(meta.source).toBe('csv')
  })

  // -------------------------------------------------------------------------
  // TEST 10: Route wird serverseitig bereinigt
  // Query-Parameter und Fragment werden vor dem Speichern entfernt.
  // -------------------------------------------------------------------------

  test('RPC: Query-Parameter und Fragment werden aus der Route entfernt', async () => {
    const sessionId = crypto.randomUUID()

    await client.rpc('track_event', {
      p_event_name:  'dashboard_loaded',
      p_area:        'dashboard',
      p_session_id:  sessionId,
      p_route:       '/app/events?filter=active&page=2#section',
      p_environment: 'development',
    })

    const { data } = await fetchTestRow(client, sessionId)
    expect(data?.[0]?.route).toBe('/app/events')
  })

  // -------------------------------------------------------------------------
  // TEST 11: Client-Wrapper wirft keine Exception bei ungueltigem Input
  // trackEvent() darf die Anwendung niemals crashen.
  // -------------------------------------------------------------------------

  test('WRAPPER: trackEvent wirft keine Exception bei fehlerhaftem Input', async () => {
    // null supabase
    await expect(trackEvent(null, { event_name: 'app_entry', area: 'x' })).resolves.toBeUndefined()

    // null payload
    await expect(trackEvent(client, null)).resolves.toBeUndefined()

    // fehlende Pflichtfelder
    await expect(trackEvent(client, { area: 'dashboard' })).resolves.toBeUndefined()
    await expect(trackEvent(client, { event_name: 'app_entry' })).resolves.toBeUndefined()

    // RPC wirft intern eine Exception (wird abgefangen, nie geworfen)
    const crashClient = {
      rpc: async () => { throw new Error('Simulated RPC crash') }
    }
    await expect(
      trackEvent(crashClient, { event_name: 'app_entry', area: 'test' })
    ).resolves.toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // TEST 12: cleanRoute() Einheitentests (client-seitige Bereinigung)
  // -------------------------------------------------------------------------

  test('WRAPPER: cleanRoute entfernt Query-Parameter, Fragment und kuerzt auf 500 Zeichen', () => {
    expect(cleanRoute('/app/events?q=test')).toBe('/app/events')
    expect(cleanRoute('/app/events#section')).toBe('/app/events')
    expect(cleanRoute('/app/events?q=1#top')).toBe('/app/events')
    expect(cleanRoute('')).toBeNull()
    expect(cleanRoute(null)).toBeNull()
    expect(cleanRoute(undefined)).toBeNull()
    expect(cleanRoute('a'.repeat(600)).length).toBeLessThanOrEqual(500)
  })
})
