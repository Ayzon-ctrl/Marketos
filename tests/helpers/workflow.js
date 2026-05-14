import fs from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

export const runId = Date.now()
export const TEST_PREFIX = 'PW_E2E_'

const credentialsByProject = new Map()
const LEGACY_TEST_MARKERS = ['Playwright', 'EVENT FLOW', 'EVENT VALIDIERUNG']
const TEST_VENDOR_CATEGORIES = [
  'Schmuck',
  'Holz',
  'Keramik',
  'Textil / Nähen',
  'Plotter / DIY',
  'Kunst',
  'Leder',
  'Glas',
  'Deko',
  '3D-Druck',
  'Kunstharz'
]

export function addDaysBerlin(offsetDays = 0) {
  const now = new Date()
  now.setDate(now.getDate() + offsetDays)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local')
  const raw = fs.readFileSync(envPath, 'utf8')
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const idx = line.indexOf('=')
        return [line.slice(0, idx), line.slice(idx + 1)]
      })
  )
}

const env = readEnvFile()

if (!env.PW_E2E_PASSWORD) {
  throw new Error(
    'PW_E2E_PASSWORD fehlt in .env.local.\n' +
    'Bitte ergänzen: PW_E2E_PASSWORD=<dein-testpasswort>'
  )
}

const TEST_PASSWORD = env.PW_E2E_PASSWORD
const AUTH_RETRY_DELAYS_MS = [1200, 2500, 5000]
const authedClientsByEmail = new Map()

function createTestClient() {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isAuthRateLimitError(error) {
  const message = String(error?.message || '')
  return /rate limit/i.test(message)
}

async function withAuthRetry(operation) {
  let lastError = null

  for (let attempt = 0; attempt <= AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (!isAuthRateLimitError(error) || attempt === AUTH_RETRY_DELAYS_MS.length) {
        throw error
      }

      await sleep(AUTH_RETRY_DELAYS_MS[attempt])
    }
  }

  throw lastError
}

function stableNumberFromString(input) {
  return Array.from(String(input || '')).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0)
}

function isTestValue(value, extras = []) {
  const text = String(value || '')
  return (
    text.startsWith(TEST_PREFIX) ||
    LEGACY_TEST_MARKERS.some(marker => text.includes(marker)) ||
    extras.some(extra => extra && text.includes(extra))
  )
}

export async function getAuthContext(client) {
  const { data: userData, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  return userData.user
}

async function getOwnedTestArtifacts(client, userId, options = {}) {
  const eventTitles = options.eventTitles || []
  const vendorNames = options.vendorNames || []

  const [{ data: ownEvents, error: eventsError }, { data: ownVendors, error: vendorsError }] = await Promise.all([
    client.from('events').select('id,title,description').eq('organizer_id', userId),
    client.from('vendor_profiles').select('id,business_name,description').eq('owner_id', userId)
  ])

  if (eventsError) throw eventsError
  if (vendorsError) throw vendorsError

  const events = (ownEvents || []).filter(
    event => isTestValue(event.title, eventTitles) || isTestValue(event.description, eventTitles)
  )
  const vendors = (ownVendors || []).filter(
    vendor =>
      isTestValue(vendor.business_name, vendorNames) ||
      isTestValue(vendor.description, vendorNames)
  )

  return {
    eventIds: events.map(event => event.id),
    vendorIds: vendors.map(vendor => vendor.id),
    events,
    vendors
  }
}

async function safeDelete(queryPromise) {
  const { error } = await queryPromise
  if (error) throw error
}

export function getAnonClient() {
  return createTestClient()
}

export function getCredentials(projectName, role = 'organizer') {
  const key = `${projectName}:${role}`

  if (!credentialsByProject.has(key)) {
    const safeProject = projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    credentialsByProject.set(key, {
      email: `marketos-pw-${safeProject}-${role}-${runId}@example.com`,
      password: TEST_PASSWORD,
      displayName: `${TEST_PREFIX}${safeProject}`,
      role
    })
  }

  return credentialsByProject.get(key)
}

export function getFallbackHeading(projectName) {
  return `${TEST_PREFIX}${projectName === 'mobile-chromium' ? 'Mobile' : 'Desktop'}`
}

export function getTestCategory(seed) {
  const index = stableNumberFromString(`${seed}-${runId}`) % TEST_VENDOR_CATEGORIES.length
  return TEST_VENDOR_CATEGORIES[index]
}

export function buildTestEventTitle(label) {
  return `${TEST_PREFIX}${label}_${runId}`
}

export function buildTestVendorName(label) {
  return `${TEST_PREFIX}${label}_${runId}`
}

export function attachConsoleTracking(page) {
  const errors = []
  const ignorePattern =
    /\/rest\/v1\/profiles\?select=\*|\/rest\/v1\/vendor_profiles|\/rest\/v1\/visitor_favorite_events|\/rest\/v1\/visitor_favorite_vendors|\/rest\/v1\/notifications|\/rest\/v1\/public_updates|\/rest\/v1\/subscriptions|\/rest\/v1\/billing_events|\/rest\/v1\/rpc\/get_public_event_vendors|\/rest\/v1\/rpc\/get_public_vendor_events|\/rest\/v1\/rpc\/get_public_event_stand_options|\/rest\/v1\/rpc\/get_public_event_stand_price_tiers|\/rest\/v1\/rpc\/get_public_event_addon_options|\/rest\/v1\/rpc\/track_event|\/rest\/v1\/rpc\/get_analytics_summary|opening_time|closing_time|public_visible/i
  const authRateLimitPattern = /auth\/v1\/token\?grant_type=password/i

  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/extension|tabs\.outgoing\.message\.ready/i.test(text)) return
    if (/Failed to load resource: the server responded with a status of 401/i.test(text)) return
    if (/Failed to load resource: the server responded with a status of (400|404) \(\)/i.test(text)) return
    if (/Failed to load resource: the server responded with a status of 429/i.test(text)) return
    if (ignorePattern.test(text)) return
    errors.push(`console:${text}`)
  })

  page.on('response', response => {
    if (response.status() < 400) return
    if (response.status() === 401 && /\/rest\/v1\/profiles\?select=\*/i.test(response.url())) return
    if (response.status() === 429 && authRateLimitPattern.test(response.url())) return
    if (ignorePattern.test(response.url())) return
    errors.push(`response:${response.status()} ${response.url()}`)
  })

  page.on('pageerror', err => {
    errors.push(`pageerror:${err.message}`)
  })

  return errors
}

export async function expectNoConsoleErrors(errors) {
  expect(errors, errors.join('\n')).toEqual([])
}

export async function openEvents(page, mobile = false) {
  if (mobile) {
    await page.getByTestId('mobile-nav-events').click()
  } else {
    await page.getByTestId('sidebar-nav-events').click()
  }
  await expect(page.getByTestId('event-form-card')).toBeVisible()
}

export async function completeProfileSetupIfVisible(page, displayName) {
  const form = page.getByTestId('profile-setup-form')
  const visible = await form
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false)

  if (visible) {
    const input = page.getByTestId('profile-name-input')
    await input.fill(displayName)
    await page.getByTestId('profile-name-save').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Name gespeichert/i)
    await expect(form).toBeHidden()
  }
}

export async function completeStyleGuideIfVisible(page) {
  const modal = page.getByTestId('style-guide-modal')
  const visible = await modal
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false)

  if (visible) {
    await page.getByTestId('style-guide-save').click()
    await expect(page.getByTestId('toast-message')).toContainText(/Style Guide gespeichert/i)
    await expect(modal).toBeHidden()
  }
}

export async function loginViaUi(page, credentials) {
  const authMarker = page.getByTestId('app-authenticated')
  const loginForm = page.getByTestId('login-form')
  const errorMessage = page.locator('.login-card .error').first()

  for (let attempt = 0; attempt <= AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
    await expect(loginForm).toBeVisible()
    await page.getByTestId('login-email').fill(credentials.email)
    await page.getByTestId('login-password').fill(credentials.password)
    await page.getByTestId('login-submit').click()

    const outcome = await Promise.race([
      authMarker.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'authenticated').catch(() => null),
      errorMessage.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error').catch(() => null)
    ])

    if (outcome === 'authenticated') return

    const currentError = (await errorMessage.textContent().catch(() => '')) || ''
    const shouldRetry = outcome !== 'authenticated' && attempt < AUTH_RETRY_DELAYS_MS.length

    if (!shouldRetry) {
      await expect(authMarker).toBeVisible({ timeout: 15000 })
      return
    }

    if (currentError && !isAuthRateLimitError({ message: currentError })) {
      await page.goto('/login')
      continue
    }

    await sleep(AUTH_RETRY_DELAYS_MS[attempt])
    await page.goto('/login')
  }
}

export async function getAuthedClient(credentials) {
  if (authedClientsByEmail.has(credentials.email)) {
    return authedClientsByEmail.get(credentials.email)
  }

  const client = createTestClient()
  const { error } = await withAuthRetry(() => client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password
  }))
  if (error) throw error
  authedClientsByEmail.set(credentials.email, client)
  return client
}

export async function userExists(credentials) {
  if (authedClientsByEmail.has(credentials.email)) return true

  const client = createTestClient()
  const { error } = await withAuthRetry(() => client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password
  }))
  await client.auth.signOut().catch(() => {})
  return !error
}

async function waitForAuthenticatedOrDuplicate(page) {
  const authMarker = page.getByTestId('app-authenticated')
  const duplicateUserHint = page.getByText(/User already registered/i)

  const result = await Promise.race([
    authMarker.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'authenticated').catch(() => null),
    duplicateUserHint.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'duplicate').catch(() => null)
  ])

  return result
}

export async function ensureAuthenticated(page, projectName, options = {}) {
  const role = options.role || 'organizer'
  const credentials = getCredentials(projectName, role)
  await page.goto('/login')

  if (await page.getByTestId('app-authenticated').count()) {
    await completeProfileSetupIfVisible(page, credentials.displayName)
    if (!options.skipStyleGuide) await completeStyleGuideIfVisible(page)
    return credentials
  }

  if (await userExists(credentials)) {
    await loginViaUi(page, credentials)
  } else {
    await page.getByRole('button', { name: /Noch kein Konto\? Registrieren/i }).click()
    await page.getByLabel('Vorname').fill('PW')
    await page.getByLabel('Nachname').fill(projectName === 'mobile-chromium' ? 'Mobile' : 'Desktop')
    await page.getByLabel('Firma / Marke').fill(`${TEST_PREFIX}QA`)
    await page.getByLabel('Rolle').selectOption(role)
    await page.getByTestId('login-email').fill(credentials.email)
    await page.getByTestId('login-password').fill(credentials.password)
    await page.getByTestId('register-submit').click()

    const registrationOutcome = await waitForAuthenticatedOrDuplicate(page)

    if (registrationOutcome === 'duplicate') {
      await page.getByRole('button', { name: /Schon Konto\? Einloggen/i }).click()
      await loginViaUi(page, credentials)
    } else if (registrationOutcome === 'authenticated') {
      // nothing else to do
    } else {
      await loginViaUi(page, credentials)
    }

    if (options.requireExplicitLogin) {
      await page.getByTestId('logout-button').click()
      await loginViaUi(page, credentials)
    }
  }

  await expect(page.getByTestId('app-authenticated')).toBeVisible()
  await completeProfileSetupIfVisible(page, credentials.displayName)
  if (!options.skipStyleGuide) await completeStyleGuideIfVisible(page)
  return credentials
}

export async function createEventRecord(credentials, overrides = {}) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthContext(client)
  const location = await getTestLocation(credentials)

  const payload = {
    organizer_id: user.id,
    title: overrides.title || buildTestEventTitle('Event'),
    event_date: overrides.event_date || addDaysBerlin(7),
    location_id: overrides.location_id || location.id,
    location: overrides.location || location.name,
    public_visible: overrides.public_visible ?? false,
    opening_time: overrides.opening_time || '10:00',
    closing_time: overrides.closing_time || '18:00',
    public_description: overrides.public_description || `${TEST_PREFIX}Sicherheits-Testevent.`
  }

  const { data, error } = await client.from('events').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function isPublicProductSchemaReady(credentials) {
  const client = await getAuthedClient(credentials)
  const checks = await Promise.all([
    client.from('visitor_favorite_events').select('id').limit(1),
    client.from('visitor_favorite_vendors').select('id').limit(1),
    client.from('public_updates').select('id').limit(1),
    client.from('notifications').select('id').limit(1)
  ])

  return checks.every(result => !result.error)
}

export async function isPublicPlatformSchemaReady(credentials) {
  const client = await getAuthedClient(credentials)
  const checks = await Promise.all([
    client.from('events').select('id,opening_time,closing_time,public_visible').limit(1),
    client.from('vendor_profiles').select('id').limit(1)
  ])

  return checks.every(result => !result.error)
}

export async function getOwnVendorProfile(credentials) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthContext(client)

  const { data, error } = await client
    .from('vendor_profiles')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function ensureVendorProfile(credentials, overrides = {}) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthContext(client)
  const existing = await getOwnVendorProfile(credentials)
  const businessName = overrides.business_name || buildTestVendorName('Händler')

  const payload = {
    owner_id: user.id,
    business_name: businessName,
    category: overrides.category || getTestCategory(businessName),
    description: overrides.description || `${TEST_PREFIX}Öffentliches Testprofil für den Event-Flow.`,
    website_url: overrides.website_url || 'https://example.com/vendor',
    public_visible: overrides.public_visible ?? true
  }

  if (existing?.id) {
    const { data, error } = await client
      .from('vendor_profiles')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await client.from('vendor_profiles').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function isStyleGuideSchemaReady(credentials) {
  const client = await getAuthedClient(credentials)
  const { error } = await client.from('profiles').select('id,has_seen_style_guide').limit(1)
  return !error
}

export async function setStyleGuideSeen(credentials, value) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthContext(client)

  const { error } = await client.from('profiles').update({ has_seen_style_guide: value }).eq('id', user.id)
  if (error) throw error
}

export async function getTestLocation(credentials) {
  const client = await getAuthedClient(credentials)
  const { data, error } = await client
    .from('locations')
    .select('id,name,postal_code')
    .eq('name', 'Kamp-Lintfort')
    .eq('postal_code', '47475')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Test-Standort Kamp-Lintfort (47475) wurde nicht gefunden.')
  return data
}

export async function cleanupOwnedTestData(credentials, options = {}) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthContext(client)
  const { eventIds, vendorIds } = await getOwnedTestArtifacts(client, user.id, options)

  if (eventIds.length) {
    await safeDelete(client.from('public_updates').delete().eq('author_id', user.id).in('event_id', eventIds))
    await safeDelete(client.from('event_participants').delete().in('event_id', eventIds))
    await safeDelete(client.from('visitor_favorite_events').delete().eq('user_id', user.id).in('event_id', eventIds))
    await safeDelete(client.from('reviews').delete().in('event_id', eventIds))
    await safeDelete(client.from('tasks').delete().eq('owner_id', user.id).in('event_id', eventIds))
    await safeDelete(client.from('events').delete().in('id', eventIds))
  }

  if (vendorIds.length) {
    await safeDelete(client.from('public_updates').delete().eq('author_id', user.id).in('vendor_profile_id', vendorIds))
    await safeDelete(client.from('vendor_images').delete().in('vendor_profile_id', vendorIds))
    await safeDelete(client.from('visitor_favorite_vendors').delete().eq('user_id', user.id).in('vendor_profile_id', vendorIds))
    await safeDelete(client.from('vendor_profiles').delete().in('id', vendorIds))
  }

  await safeDelete(
    client
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .or(`title.ilike.%${TEST_PREFIX}%,body.ilike.%${TEST_PREFIX}%,title.ilike.%Playwright%,body.ilike.%Playwright%`)
  )
}

export async function cleanupEvents(credentials, titles = []) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthContext(client)
  const { eventIds } = await getOwnedTestArtifacts(client, user.id, { eventTitles: titles })

  if (!eventIds.length) return

  await safeDelete(client.from('public_updates').delete().eq('author_id', user.id).in('event_id', eventIds))
  await safeDelete(client.from('event_participants').delete().in('event_id', eventIds))
  await safeDelete(client.from('visitor_favorite_events').delete().eq('user_id', user.id).in('event_id', eventIds))
  await safeDelete(client.from('reviews').delete().in('event_id', eventIds))
  await safeDelete(client.from('tasks').delete().eq('owner_id', user.id).in('event_id', eventIds))
  await safeDelete(client.from('events').delete().in('id', eventIds))
}

export async function resetUserEvents(credentials) {
  await cleanupEvents(credentials)
}

export async function insertBrokenEvent(credentials, title) {
  const client = await getAuthedClient(credentials)
  const user = await getAuthContext(client)
  const { data: location, error: locationError } = await client
    .from('locations')
    .select('id,name')
    .eq('name', 'Kamp-Lintfort')
    .eq('postal_code', '47475')
    .maybeSingle()

  if (locationError) throw locationError
  if (!location) throw new Error('Test-Standort Kamp-Lintfort (47475) wurde nicht gefunden.')

  const { error } = await client.from('events').insert({
    organizer_id: user.id,
    title: '',
    event_date: '2026-05-01',
    location_id: location.id,
    location: location.name,
    description: title || buildTestEventTitle('BrokenEvent'),
    status: 'open'
  })
  if (error) throw error
}

export async function ensureParticipantStatusSchema(credentials) {
  const client = await getAuthedClient(credentials)
  const { error } = await client.from('event_participants').select('id,status').limit(1)
  if (error) {
    throw new Error(
      'Teilnehmer-Status braucht ein DB-Update. Bitte zuerst supabase/event_participants_status.sql in Supabase ausführen.'
    )
  }
}

export async function selectCity(page, searchTerm, expectedOption) {
  const cityInput = page.getByTestId('event-city')
  await cityInput.fill(searchTerm)
  await expect(page.getByTestId('city-option').first()).toBeVisible()

  if (expectedOption) {
    await expect(page.getByTestId('city-option')).toHaveCount(1)
    await expect(page.getByTestId('city-option').first()).toContainText(expectedOption)
  }

  await page.getByTestId('city-option').first().click()
  await expect(cityInput).toHaveValue(expectedOption || searchTerm)
}

// Prüft ob fix_participants_rls.sql ausgeführt wurde.
// Die SECURITY DEFINER-Funktion is_event_organizer() löst die RLS-Rekursion beim INSERT
// in event_participants mit exhibitor_id IS NULL. Ohne sie schlägt der INSERT mit 42501 fehl.
export async function isParticipantRlsFixed() {
  const anonClient = getAnonClient()
  const dummyId = '00000000-0000-0000-0000-000000000000'
  const { error } = await anonClient.rpc('is_event_organizer', { p_event_id: dummyId })
  // Wenn die Funktion existiert, gibt sie false zurück (kein Fehler).
  // Wenn sie fehlt, gibt PostgREST einen "Could not find the function"-Fehler zurück.
  return !error
}

export async function isStandPricingSchemaReady(credentials) {
  const client = await getAuthedClient(credentials)
  const checks = await Promise.all([
    client.from('event_stand_options').select('id').limit(1),
    client.from('event_stand_price_tiers').select('id').limit(1),
    client.from('event_addon_options').select('id').limit(1)
  ])
  return checks.every(result => !result.error)
}

// Prüft, ob die öffentlichen Stand-Pricing-RPCs (F4.2) in der DB vorhanden sind.
// Nutzt den anon-Client mit einer Dummy-UUID – gültige RPCs geben leeres Array zurück,
// fehlende RPCs geben einen Fehler zurück.
export async function isStandPricingPublicSchemaReady() {
  const anonClient = getAnonClient()
  const dummyId = '00000000-0000-0000-0000-000000000000'
  const results = await Promise.all([
    anonClient.rpc('get_public_event_stand_options', { p_event_id: dummyId }),
    anonClient.rpc('get_public_event_stand_price_tiers', { p_event_id: dummyId }),
    anonClient.rpc('get_public_event_addon_options', { p_event_id: dummyId })
  ])
  return results.every(({ error }) => !error)
}
