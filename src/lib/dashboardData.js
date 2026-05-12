import { supabase } from '../supabaseClient'
import { getProfileName } from './eventUtils'
import { mergeTaskMetadata } from './taskUtils'

function isOptionalPublicFeatureError(error) {
  const raw = String(error?.message || error?.details || '').trim()
  return /vendor_profiles|vendor_images|visitor_favorite_|public_updates|notifications|public_visible|subscriptions|billing_events/i.test(
    raw
  )
}

export async function ensureProfile(user) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (error) throw error
  if (data) return data

  const metadata = user.user_metadata || {}
  const nextRole =
    metadata.role === 'visitor' || metadata.role === 'exhibitor' || metadata.role === 'both'
      ? metadata.role
      : 'organizer'

  const fallback = {
    id: user.id,
    first_name: metadata.first_name || '',
    last_name: metadata.last_name || '',
    company_name: metadata.company_name || user.email,
    display_name: '',
    role: nextRole,
    has_seen_style_guide: false
  }

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .upsert(fallback)
    .select()
    .single()

  if (createError) throw createError
  return created
}

function emptyResult() {
  return { data: [], error: null }
}

async function safeOptionalQuery(promise, fallbackData = []) {
  const result = await promise
  if (result.error && !isOptionalPublicFeatureError(result.error)) {
    throw result.error
  }

  if (result.error) return { data: fallbackData, error: null }
  return result
}

async function safeOptionalMaybeSingle(promise) {
  const result = await promise
  if (result.error && !isOptionalPublicFeatureError(result.error)) {
    throw result.error
  }

  if (result.error) return { data: null, error: null }
  return result
}

export async function loadDashboardData(user) {
  const profile = await ensureProfile(user)
  const profileNameDraft = getProfileName(profile, user.email)
  const roleView = profile.role === 'exhibitor' ? 'exhibitor' : 'organizer'
  const taskSchemaReady = false

  const [
    eventsResult,
    tasksResult,
    templatesResult,
    contractsResult,
    vendorProfileResult,
    subscriptionResult,
    notificationsResult,
    favoriteEventLinksResult,
    favoriteVendorLinksResult
  ] = await Promise.all([
    supabase.from('events').select('*').eq('organizer_id', profile.id).order('event_date'),
    supabase.from('tasks').select('*').eq('owner_id', profile.id).order('created_at', { ascending: false }),
    supabase.from('email_templates').select('*').eq('owner_id', profile.id).order('created_at', { ascending: false }),
    supabase.from('contracts').select('*').eq('owner_id', profile.id).order('created_at', { ascending: false }),
    safeOptionalMaybeSingle(supabase.from('vendor_profiles').select('*').eq('owner_id', profile.id).maybeSingle()),
    safeOptionalMaybeSingle(
      supabase
        .from('subscriptions')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeOptionalQuery(
      supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    ),
    safeOptionalQuery(
      supabase
        .from('visitor_favorite_events')
        .select('event_id,created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
    ),
    safeOptionalQuery(
      supabase
        .from('visitor_favorite_vendors')
        .select('vendor_profile_id,created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
    )
  ])

  for (const result of [
    eventsResult,
    tasksResult,
    templatesResult,
    contractsResult,
    vendorProfileResult,
    subscriptionResult,
    notificationsResult,
    favoriteEventLinksResult,
    favoriteVendorLinksResult
  ]) {
    if (result.error) throw result.error
  }

  const events = eventsResult.data || []
  const eventIds = events.map(event => event.id)
  const referencedLocationIds = [...new Set(events.map(event => event.location_id).filter(Boolean))]
  const vendorProfile = vendorProfileResult.data || null
  const subscription = subscriptionResult.data || null
  const vendorProfileId = vendorProfile?.id || ''
  const favoriteEventIds = (favoriteEventLinksResult.data || []).map(item => item.event_id).filter(Boolean)
  const favoriteVendorIds = (favoriteVendorLinksResult.data || [])
    .map(item => item.vendor_profile_id)
    .filter(Boolean)

  const exhibitorParticipantQuery = await supabase
    .from('event_participants')
    .select('*')
    .eq('exhibitor_id', profile.id)
    .order('created_at', { ascending: false })
  if (exhibitorParticipantQuery.error) throw exhibitorParticipantQuery.error
  const exhibitorParticipants = exhibitorParticipantQuery.data || []
  const exhibitorEventIds = [...new Set(exhibitorParticipants.map(participant => participant.event_id).filter(Boolean))]

  const [
    participantsResult,
    announcementsResult,
    reviewsResult,
    locationsResult,
    exhibitorEventsResult,
    exhibitorAnnouncementsResult,
    vendorImagesResult,
    linkableVendorsResult,
    eventUpdatesResult,
    vendorUpdatesResult,
    favoriteEventsResult,
    favoriteVendorsResult
  ] = await Promise.all([
    eventIds.length
      ? supabase.from('event_participants').select('*').in('event_id', eventIds).order('created_at', { ascending: false })
      : emptyResult(),
    eventIds.length
      ? supabase.from('announcements').select('*').in('event_id', eventIds).order('created_at', { ascending: false })
      : emptyResult(),
    eventIds.length
      ? supabase.from('reviews').select('*').in('event_id', eventIds).order('created_at', { ascending: false })
      : emptyResult(),
    referencedLocationIds.length
      ? supabase.from('locations').select('*').in('id', referencedLocationIds).order('name')
      : emptyResult(),
    exhibitorEventIds.length
      ? supabase.from('events').select('*').in('id', exhibitorEventIds).order('event_date')
      : emptyResult(),
    exhibitorEventIds.length
      ? supabase.from('announcements').select('*').in('event_id', exhibitorEventIds).order('created_at', { ascending: false })
      : emptyResult(),
    vendorProfileId
      ? safeOptionalQuery(
          supabase.from('vendor_images').select('*').eq('vendor_profile_id', vendorProfileId).order('sort_order')
        )
      : emptyResult(),
    safeOptionalQuery(
      supabase
        .from('vendor_profiles')
        .select('id,owner_id,business_name,category,public_visible')
        .eq('public_visible', true)
        .order('business_name')
    ),
    eventIds.length
      ? safeOptionalQuery(
          supabase.from('public_updates').select('*').in('event_id', eventIds).order('created_at', { ascending: false })
        )
      : emptyResult(),
    vendorProfileId
      ? safeOptionalQuery(
          supabase
            .from('public_updates')
            .select('*')
            .eq('vendor_profile_id', vendorProfileId)
            .order('created_at', { ascending: false })
        )
      : emptyResult(),
    favoriteEventIds.length
      ? safeOptionalQuery(
          supabase
            .from('events')
            .select('*')
            .in('id', favoriteEventIds)
            .eq('public_visible', true)
            .order('event_date')
        )
      : emptyResult(),
    favoriteVendorIds.length
      ? safeOptionalQuery(
          supabase
            .from('vendor_profiles')
            .select('*')
            .in('id', favoriteVendorIds)
            .eq('public_visible', true)
            .order('business_name')
        )
      : emptyResult()
  ])

  for (const result of [
    participantsResult,
    announcementsResult,
    reviewsResult,
    locationsResult,
    exhibitorEventsResult,
    exhibitorAnnouncementsResult,
    vendorImagesResult,
    linkableVendorsResult,
    eventUpdatesResult,
    vendorUpdatesResult,
    favoriteEventsResult,
    favoriteVendorsResult
  ]) {
    if (result.error) throw result.error
  }

  return {
    profile,
    profileNameDraft,
    roleView,
    events,
    participants: participantsResult.data || [],
    tasks: mergeTaskMetadata(tasksResult.data || [], taskSchemaReady),
    announcements: announcementsResult.data || [],
    templates: templatesResult.data || [],
    reviews: reviewsResult.data || [],
    contracts: contractsResult.data || [],
    locations: locationsResult.data || [],
    exhibitorParticipants,
    exhibitorEvents: exhibitorEventsResult.data || [],
    exhibitorAnnouncements: exhibitorAnnouncementsResult.data || [],
    taskSchemaReady,
    vendorProfile,
    subscription,
    vendorImages: vendorImagesResult.data || [],
    linkableVendors: linkableVendorsResult.data || [],
    publicUpdates: [...(eventUpdatesResult.data || []), ...(vendorUpdatesResult.data || [])].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    ),
    notifications: notificationsResult.data || [],
    favoriteEvents: favoriteEventsResult.data || [],
    favoriteVendors: favoriteVendorsResult.data || []
  }
}

export async function saveProfileDisplayName(profileId, displayName) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', profileId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function saveStyleGuideSeen(profileId) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ has_seen_style_guide: true })
    .eq('id', profileId)
    .select()
    .single()

  if (error) throw error
  return data
}

async function resolveDemoLocation(locations) {
  const localMatch = locations.find(location => location.name === 'Düsseldorf' || location.name === 'Duesseldorf')
  if (localMatch) return localMatch

  const { data, error } = await supabase
    .from('locations')
    .select('id,name')
    .or('name.eq.Düsseldorf,name.eq.Duesseldorf')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function seedDemoData({ profile, locations, sessionEmail }) {
  const demoLocation = await resolveDemoLocation(locations || [])

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      organizer_id: profile.id,
      title: 'Frühlingsmarkt Demo',
      event_date: '2026-05-15',
      location_id: demoLocation?.id || null,
      location: demoLocation?.name || 'Düsseldorf',
      description: 'Demo-Event für MarketOS',
      public_description: 'Ein sichtbarer Demo-Markt für die öffentliche Plattform.',
      public_visible: true,
      is_outdoor: true,
      status: 'open'
    })
    .select()
    .single()

  if (eventError) throw eventError

  await supabase.from('event_participants').insert([
    {
      event_id: event.id,
      exhibitor_id: profile.id,
      exhibitor_name: profile.company_name || 'Magne_ToGo',
      email: sessionEmail,
      paid: true,
      booth: 'A12'
    },
    {
      event_id: event.id,
      exhibitor_name: 'Kreativstand Beispiel',
      email: 'demo@example.de',
      paid: false,
      booth: 'B04'
    }
  ])

  await supabase.from('tasks').insert([
    {
      owner_id: profile.id,
      event_id: event.id,
      title: 'Aufbauzeiten veröffentlichen',
      due_date: '2026-05-10'
    },
    {
      owner_id: profile.id,
      event_id: event.id,
      title: 'Zahlungen prüfen',
      due_date: '2026-05-12'
    }
  ])

  await supabase.from('announcements').insert({
    event_id: event.id,
    author_id: profile.id,
    title: 'Aufbau ab 08:00 Uhr',
    body: 'Bitte nutzt den Ausstellerparkplatz hinter Tor B.',
    pinned: true
  })

  await supabase.from('email_templates').insert({
    owner_id: profile.id,
    name: '2 Tage vorher: Letzte Infos',
    subject: 'Letzte Infos zu {{event_name}}',
    body: 'Hallo {{name}}, hier kommen die finalen Infos zum Event.',
    send_offset_days: 2,
    active: true
  })
}
