import { supabase } from '../supabaseClient'
import { getLocalDateKey } from './eventUtils'
import { createUserSafeError } from './userError'

export const PUBLIC_SETUP_MESSAGE =
  'Die öffentliche Plattform braucht noch die Phase-1-Datenbankmigration. Bitte führe zuerst supabase/public_platform_phase1.sql in Supabase aus.'

export const PUBLIC_PRODUCT_SETUP_MESSAGE =
  'Favoriten und Updates brauchen noch die aktuelle Public-Produktmigration. Bitte führe danach supabase/public_product_core.sql in Supabase aus.'

export const PUBLIC_STAND_PRICING_SETUP_MESSAGE =
  'Die öffentliche Standflächen-Anzeige braucht noch die F4.2-Migration. Bitte führe supabase/event_stand_pricing_public.sql in Supabase aus.'

function mapPublicError(error, fallbackMessage) {
  const raw = String(error?.message || error?.details || fallbackMessage || '').trim()

  if (
    /public_visible|opening_time|vendor_profiles|vendor_images|get_public_event_vendors|get_public_vendor_events|public_description|is_indoor|is_outdoor|is_covered|is_accessible|has_parking|has_toilets|has_food/i.test(
      raw
    )
  ) {
    return createUserSafeError(PUBLIC_SETUP_MESSAGE)
  }

  if (/visitor_favorite_|public_updates|notifications/i.test(raw)) {
    return createUserSafeError(PUBLIC_PRODUCT_SETUP_MESSAGE)
  }

  if (
    /get_public_event_stand_options|get_public_event_stand_price_tiers|get_public_event_addon_options/i.test(
      raw
    )
  ) {
    return createUserSafeError(PUBLIC_STAND_PRICING_SETUP_MESSAGE)
  }

  return createUserSafeError(fallbackMessage || 'Öffentliche Daten konnten nicht geladen werden.')
}

function sortVendorsByName(vendors) {
  return [...(vendors || [])].sort((a, b) =>
    String(a.business_name || '').localeCompare(String(b.business_name || ''), 'de')
  )
}

function groupBy(items, keyName) {
  return (items || []).reduce((map, item) => {
    const key = item?.[keyName]
    if (!key) return map
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
    return map
  }, new Map())
}

function attachVendorCounts(events, vendorRows) {
  const countByEvent = (vendorRows || []).reduce((map, row) => {
    const key = row.event_id
    map.set(key, (map.get(key) || 0) + 1)
    return map
  }, new Map())

  return (events || []).map(event => ({
    ...event,
    vendor_count: countByEvent.get(event.id) || 0
  }))
}

function applyPromotionMetadata(items, promotions, targetKey) {
  const activeByTarget = new Map(
    (promotions || [])
      .map(promotion => [promotion[targetKey], promotion])
      .filter(([id]) => Boolean(id))
  )

  return (items || []).map(item => {
    const promotion = activeByTarget.get(item.id)
    return promotion
      ? {
          ...item,
          promotion_type: promotion.promotion_type,
          promotion_title: promotion.title,
          promotion_description: promotion.description
        }
      : item
  })
}

function splitPromoted(items) {
  const promoted = []
  const regular = []

  for (const item of items || []) {
    if (item?.promotion_type) promoted.push(item)
    else regular.push(item)
  }

  return { promoted, regular }
}

function isMissingPromotionsSetup(error) {
  return /promotions|promotion_type|payment_status|provider_checkout_id|provider_payment_id/i.test(
    String(error?.message || error?.details || '')
  )
}

async function fetchPublicEventsBase({ limit } = {}) {
  let query = supabase
    .from('events')
    .select(
      `
        id,
        title,
        event_date,
        location,
        location_id,
        opening_time,
        closing_time,
        is_indoor,
        is_outdoor,
        is_covered,
        is_accessible,
        has_parking,
        has_toilets,
        has_food,
        public_description,
        public_visible
      `
    )
    .eq('public_visible', true)
    .gte('event_date', getLocalDateKey())
    .order('event_date', { ascending: true })

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw mapPublicError(error, 'Öffentliche Märkte konnten nicht geladen werden.')
  return data || []
}

async function fetchPublicVendorsBase({ limit } = {}) {
  let query = supabase
    .from('vendor_profiles')
    .select(
      `
        id,
        owner_id,
        business_name,
        category,
        description,
        website_url,
        instagram_url,
        facebook_url,
        tiktok_url,
        logo_url,
        public_visible,
        created_at
      `
    )
    .eq('public_visible', true)
    .order('business_name', { ascending: true })

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw mapPublicError(error, 'Öffentliche Händler konnten nicht geladen werden.')
  return data || []
}

async function fetchPublicEventVendorRows(eventId = null) {
  const { data, error } = await supabase.rpc('get_public_event_vendors', {
    p_event_id: eventId
  })

  if (error) throw mapPublicError(error, 'Öffentliche Händler zum Markt konnten nicht geladen werden.')
  return data || []
}

async function fetchPublicVendorEventRows(vendorProfileId = null) {
  const { data, error } = await supabase.rpc('get_public_vendor_events', {
    p_vendor_profile_id: vendorProfileId
  })

  if (error) throw mapPublicError(error, 'Öffentliche Händler-Events konnten nicht geladen werden.')
  return data || []
}

async function fetchPublicUpdates({ eventId = '', vendorProfileId = '' } = {}) {
  let query = supabase
    .from('public_updates')
    .select('id,title,body,created_at,event_id,vendor_profile_id,public_visible')
    .eq('public_visible', true)
    .order('created_at', { ascending: false })

  if (eventId) query = query.eq('event_id', eventId)
  if (vendorProfileId) query = query.eq('vendor_profile_id', vendorProfileId)

  const { data, error } = await query
  if (error) throw mapPublicError(error, 'Öffentliche Updates konnten nicht geladen werden.')
  return data || []
}

async function fetchPublicStandOptions(eventId) {
  const { data, error } = await supabase.rpc('get_public_event_stand_options', {
    p_event_id: eventId
  })
  // Graceful degradation: RPC may not be deployed yet — page still shows without stand pricing
  if (error) return []
  return data || []
}

async function fetchPublicStandPriceTiers(eventId) {
  const { data, error } = await supabase.rpc('get_public_event_stand_price_tiers', {
    p_event_id: eventId
  })
  if (error) return []
  return data || []
}

async function fetchPublicAddonOptions(eventId) {
  const { data, error } = await supabase.rpc('get_public_event_addon_options', {
    p_event_id: eventId
  })
  if (error) return []
  return data || []
}

async function fetchActivePromotions(targetType, limit = 6) {
  void targetType
  void limit

  // Promotions are prepared in schema and UI, but public reads stay passive
  // until the table is rolled out everywhere and payment activation is wired.
  // Returning an empty list keeps public pages stable and avoids 404 console noise.
  return []
}

export async function loadPublicLandingData() {
  const [events, vendors, vendorRows, eventPromotions, vendorPromotions] = await Promise.all([
    fetchPublicEventsBase({ limit: 6 }),
    fetchPublicVendorsBase({ limit: 6 }),
    fetchPublicEventVendorRows(null),
    fetchActivePromotions('event', 3),
    fetchActivePromotions('vendor', 3)
  ])

  const eventsWithCounts = attachVendorCounts(events, vendorRows)
  const promotedEvents = applyPromotionMetadata(eventsWithCounts, eventPromotions, 'event_id')
  const promotedVendors = applyPromotionMetadata(vendors, vendorPromotions, 'vendor_profile_id')
  const eventGroups = splitPromoted(promotedEvents)
  const vendorGroups = splitPromoted(sortVendorsByName(promotedVendors))

  return {
    events: eventGroups.regular,
    vendors: vendorGroups.regular,
    promotedEvents: eventGroups.promoted,
    promotedVendors: vendorGroups.promoted
  }
}

export async function loadPublicMarkets() {
  const [events, vendorRows, promotions] = await Promise.all([
    fetchPublicEventsBase(),
    fetchPublicEventVendorRows(null),
    fetchActivePromotions('event', 12)
  ])

  return applyPromotionMetadata(attachVendorCounts(events, vendorRows), promotions, 'event_id').sort((a, b) => {
    const promotionWeight = Number(Boolean(b.promotion_type)) - Number(Boolean(a.promotion_type))
    if (promotionWeight !== 0) return promotionWeight
    return String(a.event_date || '').localeCompare(String(b.event_date || ''), 'de')
  })
}

export async function loadPublicMarketDetail(eventId) {
  const { data: event, error } = await supabase
    .from('events')
    .select(
      `
        id,
        title,
        event_date,
        location,
        location_id,
        opening_time,
        closing_time,
        is_indoor,
        is_outdoor,
        is_covered,
        is_accessible,
        has_parking,
        has_toilets,
        has_food,
        public_description,
        public_visible
      `
    )
    .eq('id', eventId)
    .eq('public_visible', true)
    .maybeSingle()

  if (error) throw mapPublicError(error, 'Öffentlicher Markt konnte nicht geladen werden.')
  if (!event) return { event: null, vendors: [], updates: [] }

  const [vendorRows, updates, standOptions, addonOptions, priceTiers] = await Promise.all([
    fetchPublicEventVendorRows(eventId),
    fetchPublicUpdates({ eventId }),
    fetchPublicStandOptions(eventId),
    fetchPublicAddonOptions(eventId),
    fetchPublicStandPriceTiers(eventId)
  ])

  return {
    event: {
      ...event,
      vendor_count: vendorRows.length
    },
    vendors: sortVendorsByName(vendorRows).map(vendor => ({
      ...vendor,
      id: vendor.vendor_profile_id,
      events: [{ event_id: event.id, title: event.title }]
    })),
    updates,
    standOptions,
    addonOptions,
    priceTiers
  }
}

export async function loadPublicVendors() {
  const [vendors, eventRows, promotions] = await Promise.all([
    fetchPublicVendorsBase(),
    fetchPublicVendorEventRows(null),
    fetchActivePromotions('vendor', 12)
  ])

  const eventsByVendor = groupBy(eventRows, 'vendor_profile_id')

  return sortVendorsByName(
    applyPromotionMetadata(
      vendors.map(vendor => ({
        ...vendor,
        events: eventsByVendor.get(vendor.id) || []
      })),
      promotions,
      'vendor_profile_id'
    )
  ).sort((a, b) => {
    const promotionWeight = Number(Boolean(b.promotion_type)) - Number(Boolean(a.promotion_type))
    if (promotionWeight !== 0) return promotionWeight
    return String(a.business_name || '').localeCompare(String(b.business_name || ''), 'de')
  })
}

export async function loadPublicVendorDetail(vendorId) {
  const { data: vendor, error } = await supabase
    .from('vendor_profiles')
    .select(
      `
        id,
        owner_id,
        business_name,
        category,
        description,
        website_url,
        instagram_url,
        facebook_url,
        tiktok_url,
        logo_url,
        public_visible,
        created_at
      `
    )
    .eq('id', vendorId)
    .eq('public_visible', true)
    .maybeSingle()

  if (error) throw mapPublicError(error, 'Öffentliches Händlerprofil konnte nicht geladen werden.')
  if (!vendor) return { vendor: null, images: [], events: [], updates: [] }

  const [{ data: images, error: imagesError }, events, updates] = await Promise.all([
    supabase
      .from('vendor_images')
      .select('id,image_url,caption,sort_order')
      .eq('vendor_profile_id', vendorId)
      .order('sort_order', { ascending: true }),
    fetchPublicVendorEventRows(vendorId),
    fetchPublicUpdates({ vendorProfileId: vendorId })
  ])

  if (imagesError) throw mapPublicError(imagesError, 'Händlerbilder konnten nicht geladen werden.')

  return {
    vendor,
    images: images || [],
    events,
    updates
  }
}

export async function loadEventFavoriteState(userId, eventId) {
  const { data, error } = await supabase
    .from('visitor_favorite_events')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) throw mapPublicError(error, 'Favoriten konnten nicht geladen werden.')
  return Boolean(data?.id)
}

export async function loadVendorFavoriteState(userId, vendorProfileId) {
  const { data, error } = await supabase
    .from('visitor_favorite_vendors')
    .select('id')
    .eq('user_id', userId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle()

  if (error) throw mapPublicError(error, 'Favoriten konnten nicht geladen werden.')
  return Boolean(data?.id)
}

export async function toggleEventFavorite({ userId, eventId, saved }) {
  if (saved) {
    const { error } = await supabase
      .from('visitor_favorite_events')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId)
    if (error) throw mapPublicError(error, 'Markt konnte nicht aus Favoriten entfernt werden.')
    return false
  }

  const { error } = await supabase.from('visitor_favorite_events').insert({
    user_id: userId,
    event_id: eventId
  })
  if (error) throw mapPublicError(error, 'Markt konnte nicht gespeichert werden.')
  return true
}

export async function toggleVendorFavorite({ userId, vendorProfileId, saved }) {
  if (saved) {
    const { error } = await supabase
      .from('visitor_favorite_vendors')
      .delete()
      .eq('user_id', userId)
      .eq('vendor_profile_id', vendorProfileId)
    if (error) throw mapPublicError(error, 'Händler konnte nicht aus Favoriten entfernt werden.')
    return false
  }

  const { error } = await supabase.from('visitor_favorite_vendors').insert({
    user_id: userId,
    vendor_profile_id: vendorProfileId
  })
  if (error) throw mapPublicError(error, 'Händler konnte nicht gespeichert werden.')
  return true
}
