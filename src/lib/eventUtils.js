export const vendorCategorySuggestions = [
  'Schmuck',
  'Holz',
  'Keramik',
  'Textil / Nähen',
  'Plotter / DIY',
  'Kunst',
  'Leder',
  'Glas',
  'Deko'
]

export function fmtDate(date) {
  if (!date) return 'Ohne Datum'
  return new Date(`${date}T12:00:00`).toLocaleDateString('de-DE')
}

export function fmtTime(time) {
  if (!time) return ''
  return `${String(time).slice(0, 5)} Uhr`
}

export function fmtOpeningHours(openingTime, closingTime) {
  if (!openingTime && !closingTime) return 'Öffnungszeiten folgen'
  if (openingTime && closingTime) return `${fmtTime(openingTime)} – ${fmtTime(closingTime)}`
  if (openingTime) return `Ab ${fmtTime(openingTime)}`
  return `Bis ${fmtTime(closingTime)}`
}

export function getEventVenueFacts(event) {
  return [
    [event?.is_indoor, 'Indoor'],
    [event?.is_outdoor, 'Outdoor'],
    [event?.is_covered, 'Überdacht'],
    [event?.is_accessible, 'Barrierefrei'],
    [event?.has_parking, 'Parken'],
    [event?.has_toilets, 'WC'],
    [event?.has_food, 'Gastronomie']
  ]
}

export function getEventVisibilityLabel(event) {
  return event?.public_visible ? 'Öffentlich' : 'Intern'
}

export function hasEventQualityIssues(event) {
  if (!event) return false
  if (Array.isArray(event.problems) && event.problems.length > 0) return true
  if (!String(event.title || '').trim()) return true
  if (!event.event_date) return true
  if (!event.location_id) return true
  return false
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysToDateKey(dateKey, days) {
  if (!dateKey) return ''
  const next = new Date(`${dateKey}T12:00:00`)
  next.setDate(next.getDate() + days)
  return getLocalDateKey(next)
}

export function isDateWithinRange(dateKey, startDateKey, endDateKey) {
  if (!dateKey) return false
  return dateKey >= startDateKey && dateKey <= endDateKey
}

export function validateEvents(events, locations) {
  const locationIds = new Set((locations || []).map(location => location.id))

  return (events || [])
    .map(event => {
      const problems = []

      if (!String(event.title || '').trim()) problems.push('Eventname fehlt')
      if (!event.event_date) problems.push('Datum fehlt')
      if (!event.location_id) problems.push('Stadt fehlt')
      if (event.location_id && !locationIds.has(event.location_id)) {
        problems.push('Stadt-ID ist ungültig')
      }

      return { ...event, problems }
    })
    .filter(event => event.problems.length > 0)
}

export function getProfileName(profile, email) {
  const fullName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  const candidates = [profile?.display_name, fullName, profile?.company_name, email]
    .map(value => String(value || '').trim())
    .filter(Boolean)

  return candidates.find(value => !value.includes('@')) || ''
}

export function getGreetingForHour(hour) {
  const normalizedHour = Number.isFinite(hour) ? hour : new Date().getHours()

  if (normalizedHour >= 5 && normalizedHour < 11) return 'Guten Morgen'
  if (normalizedHour >= 11 && normalizedHour < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export function getGreeting(date = new Date()) {
  return getGreetingForHour(date.getHours())
}

export function validateEventForm(form) {
  const errors = {}

  if (!form.title?.trim()) errors.title = 'Eventname ist Pflicht.'
  if (!form.event_date) errors.event_date = 'Datum ist Pflicht.'
  if (!form.location_id) errors.location_id = 'Stadt ist Pflicht.'

  return errors
}

export function normalizeLocationSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim()
}

export function dedupeLocations(list) {
  const scored = (list || []).map(location => ({
    location,
    baseName: normalizeLocationSearch(location.name),
    postalCode: String(location.postal_code || '').trim(),
    score:
      (location.ags ? 4 : 0) +
      (location.postal_code ? 2 : 0) +
      (location.state && location.state !== 'NRW' ? 1 : 0)
  }))

  const namesWithPostalCode = new Set(scored.filter(entry => entry.postalCode).map(entry => entry.baseName))
  const byKey = new Map()

  for (const entry of scored) {
    if (!entry.postalCode && namesWithPostalCode.has(entry.baseName)) continue

    const key = entry.postalCode ? `${entry.baseName}-${entry.postalCode}` : entry.baseName
    const current = byKey.get(key)
    if (!current || entry.score > current.score) byKey.set(key, entry)
  }

  return [...byKey.values()].map(entry => entry.location)
}
