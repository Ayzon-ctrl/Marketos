import { useMemo, useState } from 'react'
import { trackEvent } from '../../lib/analytics'
import { useEffect, useRef } from 'react'
import { Globe, Plus, Trash2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { getEventVisibilityLabel, validateEventForm } from '../../lib/eventUtils'
import { getUserErrorMessage } from '../../lib/userError'
import CityAutocomplete from '../CityAutocomplete'
import ConfirmModal from '../ConfirmModal'
import EventCard from '../EventCard'
import EventStandPricingSection from '../event-detail/EventStandPricingSection'

const PARTICIPANT_STATUS_LABELS = {
  angefragt: 'In Prüfung',
  bestaetigt: 'Bestätigt',
  warteliste: 'Warteliste',
  abgesagt: 'Abgesagt'
}

const EXHIBITOR_INFO_FIELDS = [
  'setup_start_time',
  'setup_end_time',
  'teardown_start_time',
  'teardown_end_time',
  'arrival_notes',
  'access_notes',
  'exhibitor_contact_name',
  'exhibitor_contact_phone',
  'emergency_contact_name',
  'emergency_contact_phone',
  'power_notes',
  'parking_notes',
  'waste_notes',
  'exhibitor_general_notes'
]

const EDIT_EVENT_STORAGE_KEY = 'marketos-edit-event-id'

function createEmptyExhibitorInfo() {
  return {
    setup_start_time: '',
    setup_end_time: '',
    teardown_start_time: '',
    teardown_end_time: '',
    arrival_notes: '',
    access_notes: '',
    exhibitor_contact_name: '',
    exhibitor_contact_phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    power_notes: '',
    parking_notes: '',
    waste_notes: '',
    exhibitor_general_notes: ''
  }
}

function createInitialForm() {
  return {
    title: '',
    event_date: '',
    location_id: '',
    location: null,
    description: '',
    public_description: '',
    opening_time: '',
    closing_time: '',
    is_indoor: false,
    is_outdoor: true,
    is_covered: false,
    is_accessible: false,
    has_parking: false,
    has_toilets: false,
    has_food: false,
    public_visible: false,
    ...createEmptyExhibitorInfo()
  }
}

function buildEventForm(event, locations, exhibitorInfo = null) {
  const currentLocation =
    locations.find(location => location.id === event.location_id) ||
    (event.location_id ? { id: event.location_id, name: event.location || '' } : null)

  return {
    title: event.title || '',
    event_date: event.event_date || '',
    location_id: event.location_id || '',
    location: currentLocation,
    description: event.description || '',
    public_description: event.public_description || '',
    opening_time: event.opening_time || '',
    closing_time: event.closing_time || '',
    is_indoor: Boolean(event.is_indoor),
    is_outdoor: event.is_outdoor !== false,
    is_covered: Boolean(event.is_covered),
    is_accessible: Boolean(event.is_accessible),
    has_parking: Boolean(event.has_parking),
    has_toilets: Boolean(event.has_toilets),
    has_food: Boolean(event.has_food),
    public_visible: Boolean(event.public_visible),
    ...createEmptyExhibitorInfo(),
    ...Object.fromEntries(EXHIBITOR_INFO_FIELDS.map(field => [field, exhibitorInfo?.[field] || '']))
  }
}

function buildExhibitorInfoPayload(form) {
  return {
    setup_start_time: form.setup_start_time || null,
    setup_end_time: form.setup_end_time || null,
    teardown_start_time: form.teardown_start_time || null,
    teardown_end_time: form.teardown_end_time || null,
    arrival_notes: form.arrival_notes.trim() || null,
    access_notes: form.access_notes.trim() || null,
    exhibitor_contact_name: form.exhibitor_contact_name.trim() || null,
    exhibitor_contact_phone: form.exhibitor_contact_phone.trim() || null,
    emergency_contact_name: form.emergency_contact_name.trim() || null,
    emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    power_notes: form.power_notes.trim() || null,
    parking_notes: form.parking_notes.trim() || null,
    waste_notes: form.waste_notes.trim() || null,
    exhibitor_general_notes: form.exhibitor_general_notes.trim() || null
  }
}

function hasExhibitorInfoValues(payload) {
  return Object.values(payload).some(value => value !== null)
}

export default function EventsView({
  events,
  profile,
  locations,
  reload,
  notify,
  eventIssues,
  openEventDetail,
  eventEditIntent = null,
  clearEventEditIntent
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState(createInitialForm())
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loadingExhibitorInfo, setLoadingExhibitorInfo] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [editingEventId, setEditingEventId] = useState('')
  const [eventToDelete, setEventToDelete] = useState(null)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importSourceId, setImportSourceId] = useState('')
  const [importBasics, setImportBasics] = useState(true)
  const [importExhibitorInfo, setImportExhibitorInfo] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importEvents, setImportEvents] = useState([])
  const [importEventsLoading, setImportEventsLoading] = useState(false)
  const [importOverwriteConfirm, setImportOverwriteConfirm] = useState(false)
  const [importStandPricing, setImportStandPricing] = useState(true)
  const [importStandOverwriteConfirm, setImportStandOverwriteConfirm] = useState(false)
  const [importParticipants, setImportParticipants] = useState(false)
  const [selectedParticipantIds, setSelectedParticipantIds] = useState(new Set())
  const [sourceParticipants, setSourceParticipants] = useState([])
  const [sourceParticipantsLoading, setSourceParticipantsLoading] = useState(false)
  const [eventSearch, setEventSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState('alle')
  const [sortOrder, setSortOrder] = useState('upcoming')
  const formCardRef = useRef(null)

  const visibleEvents = useMemo(() => events.filter(event => event.public_visible), [events])
  const hiddenEvents = events.length - visibleEvents.length
  const editingEvent = useMemo(
    () => events.find(event => event.id === editingEventId) || null,
    [editingEventId, events]
  )
  const requiredFieldChecklist = useMemo(
    () => [
      { key: 'title', label: 'Eventname', done: Boolean(form.title.trim()) },
      { key: 'event_date', label: 'Datum', done: Boolean(form.event_date) },
      { key: 'location_id', label: 'Ort', done: Boolean(form.location_id) }
    ],
    [form.event_date, form.location_id, form.title]
  )
  const missingRequiredFields = useMemo(
    () => requiredFieldChecklist.filter(item => !item.done),
    [requiredFieldChecklist]
  )
  const missingRequiredCount = missingRequiredFields.length
  const requiredProgressText =
    missingRequiredCount === 0
      ? 'Alle Pflichtangaben zum Speichern sind vorhanden.'
      : `Noch ${missingRequiredCount} Pflichtangabe${missingRequiredCount === 1 ? '' : 'n'} fehl${
          missingRequiredCount === 1 ? 't' : 'en'
        }.`
  const normalizedEventSearch = eventSearch.trim().toLowerCase()
  const filteredAndSortedEvents = useMemo(() => {
    const matchesVisibility = event => {
      if (visibilityFilter === 'oeffentlich') return Boolean(event.public_visible)
      if (visibilityFilter === 'intern') return !event.public_visible
      return true
    }

    const matchesSearch = event => {
      if (!normalizedEventSearch) return true
      const searchableText = [
        event.title,
        event.location,
        event.description,
        event.public_description
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedEventSearch)
    }

    const sortedEvents = events
      .filter(event => matchesVisibility(event) && matchesSearch(event))
      .slice()

    sortedEvents.sort((left, right) => {
      if (sortOrder === 'name-asc') {
        return String(left.title || '').localeCompare(String(right.title || ''), 'de', {
          sensitivity: 'base'
        })
      }

      const leftDate = left.event_date ? new Date(left.event_date).getTime() : Number.NaN
      const rightDate = right.event_date ? new Date(right.event_date).getTime() : Number.NaN
      const leftHasDate = Number.isFinite(leftDate)
      const rightHasDate = Number.isFinite(rightDate)

      if (!leftHasDate && !rightHasDate) {
        return String(left.title || '').localeCompare(String(right.title || ''), 'de', {
          sensitivity: 'base'
        })
      }

      if (!leftHasDate) return 1
      if (!rightHasDate) return -1

      if (sortOrder === 'latest') {
        return rightDate - leftDate
      }

      return leftDate - rightDate
    })

    return sortedEvents
  }, [events, normalizedEventSearch, sortOrder, visibilityFilter])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const queuedStorageValue = window.localStorage.getItem(EDIT_EVENT_STORAGE_KEY)
    let queuedEventPayload = null

    if (queuedStorageValue?.startsWith('{')) {
      try {
        queuedEventPayload = JSON.parse(queuedStorageValue)
      } catch {
        queuedEventPayload = null
      }
    }

    const queuedEventId =
      eventEditIntent?.id ||
      location.state?.editEventId ||
      queuedEventPayload?.id ||
      queuedStorageValue
    if (!queuedEventId || editingEventId === queuedEventId) return

    const queuedEvent = events.find(event => event.id === queuedEventId) || eventEditIntent?.event || queuedEventPayload
    if (!queuedEvent) return

    if (queuedStorageValue) {
      window.localStorage.removeItem(EDIT_EVENT_STORAGE_KEY)
    }
    editEvent(queuedEvent).then(() => {
      window.requestAnimationFrame(() => {
        formCardRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      })
      clearEventEditIntent?.()
      if (location.state?.editEventId) {
        navigate(location.pathname, { replace: true, state: {} })
      }
    })
  }, [
    clearEventEditIntent,
    editingEventId,
    eventEditIntent,
    events,
    location.pathname,
    location.state,
    locations,
    navigate
  ])
  const hasActiveEventListControls =
    normalizedEventSearch.length > 0 || visibilityFilter !== 'alle' || sortOrder !== 'upcoming'
  const resultCountText =
    filteredAndSortedEvents.length === 0
      ? hasActiveEventListControls
        ? 'Keine Events gefunden'
        : 'Keine Events gefunden'
      : hasActiveEventListControls
        ? `${filteredAndSortedEvents.length} Event${filteredAndSortedEvents.length === 1 ? '' : 's'} gefunden`
        : `${filteredAndSortedEvents.length} Event${filteredAndSortedEvents.length === 1 ? '' : 's'}`

  function resetEventListControls() {
    setEventSearch('')
    setVisibilityFilter('alle')
    setSortOrder('upcoming')
  }

  function resetForm() {
    setForm(createInitialForm())
    setFormErrors({})
    setEditingEventId('')
    setLoadingExhibitorInfo(false)
    setImportOpen(false)
    setImportSourceId('')
    setImportOverwriteConfirm(false)
    setImportStandPricing(true)
    setImportStandOverwriteConfirm(false)
    setImportParticipants(false)
    setSelectedParticipantIds(new Set())
    setSourceParticipants([])
    setSourceParticipantsLoading(false)
  }

  async function loadEventExhibitorInfo(eventId) {
    const { data, error } = await supabase
      .from('event_exhibitor_info')
      .select(
        'setup_start_time,setup_end_time,teardown_start_time,teardown_end_time,arrival_notes,access_notes,exhibitor_contact_name,exhibitor_contact_phone,emergency_contact_name,emergency_contact_phone,power_notes,parking_notes,waste_notes,exhibitor_general_notes'
      )
      .eq('event_id', eventId)
      .maybeSingle()

    if (error) throw error
    return data || null
  }

  async function syncEventExhibitorInfo(eventId, currentForm) {
    const payload = buildExhibitorInfoPayload(currentForm)

    if (!hasExhibitorInfoValues(payload)) {
      const { error } = await supabase.from('event_exhibitor_info').delete().eq('event_id', eventId)
      if (error) throw error
      return null
    }

    const { data, error } = await supabase
      .from('event_exhibitor_info')
      .upsert({ event_id: eventId, ...payload }, { onConflict: 'event_id' })
      .select(
        'setup_start_time,setup_end_time,teardown_start_time,teardown_end_time,arrival_notes,access_notes,exhibitor_contact_name,exhibitor_contact_phone,emergency_contact_name,emergency_contact_phone,power_notes,parking_notes,waste_notes,exhibitor_general_notes'
      )
      .single()

    if (error) throw error
    return data
  }

  async function openImportDialog() {
    trackEvent(supabase, {
      event_name: 'import_dialog_opened',
      area: 'events',
      role_context: 'organizer',
    })
    setImportOpen(true)
    setImportSourceId('')
    setImportBasics(true)
    setImportExhibitorInfo(true)
    setImportOverwriteConfirm(false)
    setImportStandPricing(true)
    setImportStandOverwriteConfirm(false)
    setImportParticipants(false)
    setSelectedParticipantIds(new Set())
    setSourceParticipants([])
    setImportEventsLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id,title,event_date,location')
        .eq('organizer_id', profile.id)
        .order('event_date', { ascending: false })
      if (error) throw error
      setImportEvents((data || []).filter(e => e.id !== editingEventId))
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Eigene Events konnten nicht geladen werden.'))
      setImportOpen(false)
    } finally {
      setImportEventsLoading(false)
    }
  }

  function closeImportDialog() {
    setImportOpen(false)
    setImportSourceId('')
    setImportOverwriteConfirm(false)
    setImportStandOverwriteConfirm(false)
    setSelectedParticipantIds(new Set())
    setSourceParticipants([])
  }

  async function loadSourceParticipants(sourceId) {
    if (!sourceId) {
      setSourceParticipants([])
      return
    }
    setSourceParticipantsLoading(true)
    try {
      const { data, error } = await supabase
        .from('event_participants')
        .select('id,exhibitor_name,email,status,paid,booth,exhibitor_id')
        .eq('event_id', sourceId)
        .order('exhibitor_name', { ascending: true })
      if (error) throw error
      setSourceParticipants(data || [])
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Teilnehmer des Quellevents konnten nicht geladen werden.'))
      setSourceParticipants([])
    } finally {
      setSourceParticipantsLoading(false)
    }
  }

  function handleSourceChange(newSourceId) {
    setImportSourceId(newSourceId)
    setSelectedParticipantIds(new Set())
    if (newSourceId && importParticipants) {
      loadSourceParticipants(newSourceId)
    } else {
      setSourceParticipants([])
    }
  }

  async function doImportParticipants(targetEventId) {
    if (selectedParticipantIds.size === 0) return { imported: 0, skipped: 0 }

    // Fetch existing participants in target for dedup (by email and exhibitor_id)
    const { data: existingParticipants, error: existingErr } = await supabase
      .from('event_participants')
      .select('email,exhibitor_id')
      .eq('event_id', targetEventId)
    if (existingErr) throw existingErr

    const existingEmails = new Set(
      (existingParticipants || [])
        .filter(p => p.email)
        .map(p => p.email.toLowerCase().trim())
    )
    const existingExhibitorIds = new Set(
      (existingParticipants || [])
        .filter(p => p.exhibitor_id)
        .map(p => p.exhibitor_id)
    )

    const toImport = sourceParticipants.filter(p => selectedParticipantIds.has(p.id))
    let imported = 0
    let skipped = 0

    for (const participant of toImport) {
      const emailNorm = participant.email?.toLowerCase().trim()

      if (emailNorm && existingEmails.has(emailNorm)) {
        skipped++
        continue
      }
      if (participant.exhibitor_id && existingExhibitorIds.has(participant.exhibitor_id)) {
        skipped++
        continue
      }

      const { error: insertErr } = await supabase.from('event_participants').insert({
        event_id: targetEventId,
        exhibitor_name: participant.exhibitor_name,
        email: participant.email || null,
        exhibitor_id: participant.exhibitor_id || null,
        status: 'angefragt',
        paid: false,
        booth: null
      })
      if (insertErr) throw insertErr

      if (emailNorm) existingEmails.add(emailNorm)
      if (participant.exhibitor_id) existingExhibitorIds.add(participant.exhibitor_id)
      imported++
    }

    return { imported, skipped }
  }

  async function doImportStandPricing(targetEventId) {
    const STAND_OPTION_FIELDS =
      'label,description,area_type,surface_types,surface_notes,pricing_type,' +
      'width_m,depth_m,min_length_m,max_length_m,included_length_m,max_depth_m,' +
      'price_cents,price_per_meter_cents,price_per_sqm_cents,price_per_extra_meter_cents,' +
      'is_price_on_request,pricing_description,is_available,sort_order'
    const PRICE_TIER_FIELDS =
      'label,min_length_m,max_length_m,min_depth_m,max_depth_m,min_area_sqm,max_area_sqm,' +
      'price_cents,price_per_meter_cents,price_per_sqm_cents,price_per_extra_meter_cents,' +
      'is_price_on_request,sort_order'
    const ADDON_FIELDS =
      'addon_type,label,description,price_cents,is_price_on_request,is_available,sort_order'

    const { data: srcOptions, error: srcOptionsErr } = await supabase
      .from('event_stand_options')
      .select(`id,${STAND_OPTION_FIELDS}`)
      .eq('event_id', importSourceId)
      .order('sort_order', { ascending: true })
    if (srcOptionsErr) throw srcOptionsErr

    const oldToNewMap = new Map()

    if (srcOptions && srcOptions.length > 0) {
      // Insert each stand option individually so the mapping old_id → new_id
      // is built directly from each insert result, independent of return order.
      for (const { id: srcId, ...srcFields } of srcOptions) {
        const { data: inserted, error: insertErr } = await supabase
          .from('event_stand_options')
          .insert({ ...srcFields, event_id: targetEventId, public_visible: false })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        oldToNewMap.set(srcId, inserted.id)
      }

      const { data: srcTiers, error: srcTiersErr } = await supabase
        .from('event_stand_price_tiers')
        .select(`stand_option_id,${PRICE_TIER_FIELDS}`)
        .in('stand_option_id', srcOptions.map(o => o.id))
      if (srcTiersErr) throw srcTiersErr

      if (srcTiers && srcTiers.length > 0) {
        const tiersPayload = srcTiers
          .filter(tier => oldToNewMap.has(tier.stand_option_id))
          .map(({ stand_option_id, ...rest }) => ({
            ...rest,
            stand_option_id: oldToNewMap.get(stand_option_id)
          }))

        if (tiersPayload.length > 0) {
          const { error: insertTiersErr } = await supabase
            .from('event_stand_price_tiers')
            .insert(tiersPayload)
          if (insertTiersErr) throw insertTiersErr
        }
      }
    }

    const { data: srcAddons, error: srcAddonsErr } = await supabase
      .from('event_addon_options')
      .select(`id,${ADDON_FIELDS}`)
      .eq('event_id', importSourceId)
      .order('sort_order', { ascending: true })
    if (srcAddonsErr) throw srcAddonsErr

    if (srcAddons && srcAddons.length > 0) {
      const addonsPayload = srcAddons.map(({ id, ...rest }) => ({
        ...rest,
        event_id: targetEventId,
        public_visible: false
      }))

      const { error: insertAddonsErr } = await supabase
        .from('event_addon_options')
        .insert(addonsPayload)
      if (insertAddonsErr) throw insertAddonsErr
    }
  }

  async function doImport() {
    setImporting(true)
    setImportOverwriteConfirm(false)
    setImportStandOverwriteConfirm(false)
    try {
      let updatedForm = { ...form }

      if (importBasics) {
        const { data: srcEvent, error: srcErr } = await supabase
          .from('events')
          .select(
            'title,location_id,location,description,public_description,opening_time,closing_time,is_indoor,is_outdoor,is_covered,is_accessible,has_parking,has_toilets,has_food'
          )
          .eq('id', importSourceId)
          .single()
        if (srcErr) throw srcErr

        const srcLocation = srcEvent.location_id
          ? locations.find(l => l.id === srcEvent.location_id) ||
            { id: srcEvent.location_id, name: srcEvent.location || '' }
          : null

        updatedForm = {
          ...updatedForm,
          title: srcEvent.title || '',
          location_id: srcEvent.location_id || '',
          location: srcLocation,
          description: srcEvent.description || '',
          public_description: srcEvent.public_description || '',
          opening_time: srcEvent.opening_time || '',
          closing_time: srcEvent.closing_time || '',
          is_indoor: Boolean(srcEvent.is_indoor),
          is_outdoor: srcEvent.is_outdoor !== false,
          is_covered: Boolean(srcEvent.is_covered),
          is_accessible: Boolean(srcEvent.is_accessible),
          has_parking: Boolean(srcEvent.has_parking),
          has_toilets: Boolean(srcEvent.has_toilets),
          has_food: Boolean(srcEvent.has_food)
        }
      }

      if (importExhibitorInfo) {
        const { data: srcInfo, error: srcInfoErr } = await supabase
          .from('event_exhibitor_info')
          .select(EXHIBITOR_INFO_FIELDS.join(','))
          .eq('event_id', importSourceId)
          .maybeSingle()
        if (srcInfoErr) throw srcInfoErr

        updatedForm = {
          ...updatedForm,
          ...Object.fromEntries(EXHIBITOR_INFO_FIELDS.map(f => [f, srcInfo?.[f] || '']))
        }
      }

      if (importStandPricing) {
        await doImportStandPricing(editingEventId)
      }

      let participantResult = { imported: 0, skipped: 0 }
      if (importParticipants) {
        participantResult = await doImportParticipants(editingEventId)
      }

      setForm(updatedForm)
      closeImportDialog()

      let successMsg = 'Daten wurden übernommen. Bitte prüfen und speichern.'
      if (importParticipants && (participantResult.imported > 0 || participantResult.skipped > 0)) {
        const parts = []
        if (participantResult.imported > 0)
          parts.push(`${participantResult.imported} Aussteller importiert`)
        if (participantResult.skipped > 0)
          parts.push(`${participantResult.skipped} bereits vorhanden und übersprungen`)
        successMsg = `Daten wurden übernommen: ${parts.join(', ')}. Bitte prüfen und speichern.`
      }
      notify?.('success', successMsg)

      // import_completed – fire-and-forget, kein Freitext, nur strukturierte Booleans/Zahlen.
      trackEvent(supabase, {
        event_name: 'import_completed',
        area: 'events',
        role_context: 'organizer',
        result: 'success',
        metadata: {
          import_basics: importBasics,
          import_exhibitor_info: importExhibitorInfo,
          import_stand_pricing: importStandPricing,
          import_participants: importParticipants,
          ...(importParticipants && selectedParticipantIds.size > 0 && {
            selected_participant_count: selectedParticipantIds.size,
          }),
          ...(importParticipants && participantResult.skipped > 0 && {
            skipped_count: participantResult.skipped,
          }),
        },
      })
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Import fehlgeschlagen.'))
    } finally {
      setImporting(false)
    }
  }

  async function handleImport() {
    if (!importSourceId) {
      notify?.('error', 'Bitte wähle ein Event aus.')
      return
    }
    if (!importBasics && !importExhibitorInfo && !importStandPricing && !importParticipants) {
      notify?.('error', 'Bitte wähle mindestens eine Option aus.')
      return
    }
    if (importParticipants && !importBasics && !importExhibitorInfo && !importStandPricing) {
      if (sourceParticipants.length > 0 && selectedParticipantIds.size === 0) {
        notify?.('error', 'Bitte mindestens einen Teilnehmer auswählen oder den Teilnehmerimport deaktivieren.')
        return
      }
    }
    if (importExhibitorInfo && hasExhibitorInfoValues(buildExhibitorInfoPayload(form))) {
      setImportOverwriteConfirm(true)
      return
    }
    if (importStandPricing) {
      try {
        const { count, error } = await supabase
          .from('event_stand_options')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', editingEventId)
        if (error) throw error
        if ((count ?? 0) > 0) {
          setImportStandOverwriteConfirm(true)
          return
        }
      } catch (err) {
        notify?.('error', getUserErrorMessage(err, 'Standdaten konnten nicht geprüft werden.'))
        return
      }
    }
    doImport()
  }

  async function editEvent(event) {
    setEditingEventId(event.id)
    setForm(buildEventForm(event, locations))
    setFormErrors({})
    setLoadingExhibitorInfo(true)

    try {
      const exhibitorInfo = await loadEventExhibitorInfo(event.id)
      setForm(current => ({
        ...current,
        ...Object.fromEntries(EXHIBITOR_INFO_FIELDS.map(field => [field, exhibitorInfo?.[field] || '']))
      }))
      notify?.('success', 'Event zum Bearbeiten geladen. Pflichtfelder prüfen und speichern.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Ausstellerinfos konnten nicht geladen werden.'))
    } finally {
      setLoadingExhibitorInfo(false)
    }
  }

  async function saveEvent(event) {
    event.preventDefault()
    if (saving || loadingExhibitorInfo) return

    const errors = validateEventForm(form)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      notify?.('error', 'Bitte fülle alle Pflichtfelder aus.')
      return
    }

    const selectedLocation = form.location || locations.find(location => location.id === form.location_id)
    if (!selectedLocation) {
      setFormErrors({ location_id: 'Bitte wähle eine Stadt aus der Liste aus.' })
      notify?.('error', 'Bitte wähle eine Stadt aus der Liste aus.')
      return
    }

    setSaving(true)
    try {
      const isEditing = Boolean(editingEventId)
      const payload = {
        title: form.title.trim(),
        event_date: form.event_date,
        location_id: selectedLocation.id,
        location: selectedLocation.name,
        description: form.description.trim() || null,
        public_description: form.public_description.trim() || null,
        opening_time: form.opening_time || null,
        closing_time: form.closing_time || null,
        is_indoor: Boolean(form.is_indoor),
        is_outdoor: Boolean(form.is_outdoor),
        is_covered: Boolean(form.is_covered),
        is_accessible: Boolean(form.is_accessible),
        has_parking: Boolean(form.has_parking),
        has_toilets: Boolean(form.has_toilets),
        has_food: Boolean(form.has_food),
        public_visible: isEditing ? Boolean(form.public_visible) : false,
        organizer_id: profile.id,
        status: 'open'
      }

      const query = isEditing
        ? supabase.from('events').update(payload).eq('id', editingEventId).select().single()
        : supabase.from('events').insert(payload).select().single()

      const { data, error } = await query
      if (error) throw error

      const savedEventId = data?.id || editingEventId
      let syncedExhibitorInfo = null

      try {
        syncedExhibitorInfo = await syncEventExhibitorInfo(savedEventId, form)
      } catch (infoError) {
        await reload()
        if (!isEditing && savedEventId) {
          setEditingEventId(savedEventId)
          setForm(
            buildEventForm(
              { ...data, ...payload, id: savedEventId, location_id: selectedLocation.id, location: selectedLocation.name },
              locations,
              buildExhibitorInfoPayload(form)
            )
          )
          setFormErrors({})
        }
        notify?.(
          'error',
          getUserErrorMessage(infoError, 'Event wurde gespeichert, aber Ausstellerinfos konnten nicht gespeichert werden.')
        )
        return
      }

      if (isEditing) {
        resetForm()
      } else if (savedEventId) {
        setEditingEventId(savedEventId)
        setForm(
          buildEventForm(
            { ...data, ...payload, id: savedEventId, location_id: selectedLocation.id, location: selectedLocation.name },
            locations,
            syncedExhibitorInfo
          )
        )
        setFormErrors({})
      }

      await reload()

      notify?.(
        'success',
        isEditing
          ? 'Event aktualisiert. Die Datenprüfung wurde neu geladen.'
          : 'Event gespeichert. Es ist noch intern und kann jetzt veröffentlicht werden.'
      )

      // event_saved – fire-and-forget, kein Freitext.
      trackEvent(supabase, {
        event_name: 'event_saved',
        area: 'events',
        role_context: 'organizer',
        result: 'success',
      })
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Event konnte nicht gespeichert werden.'))
    } finally {
      setSaving(false)
    }
  }

  async function updateEventVisibility(event, nextVisible) {
    if (!event?.id || publishing) return

    setPublishing(true)
    try {
      const { error } = await supabase
        .from('events')
        .update({ public_visible: nextVisible })
        .eq('id', event.id)

      if (error) throw error

      if (editingEventId === event.id) {
        setForm(current => ({ ...current, public_visible: nextVisible }))
      }

      await reload()
      notify?.(
        'success',
        nextVisible
          ? 'Event veröffentlicht. Es ist jetzt auf Landingpage und Märkten sichtbar.'
          : 'Event ist jetzt wieder intern.'
      )

      // event_published – nur beim Veröffentlichen tracken, nicht beim Zurückziehen.
      if (nextVisible) {
        trackEvent(supabase, {
          event_name: 'event_published',
          area: 'events',
          role_context: 'organizer',
          result: 'success',
        })
      }
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Sichtbarkeit konnte nicht gespeichert werden.'))
    } finally {
      setPublishing(false)
    }
  }

  async function confirmDeleteEvent() {
    if (!eventToDelete) return

    setDeletingEvent(true)
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventToDelete.id)
      if (error) throw error
      if (editingEventId === eventToDelete.id) resetForm()
      await reload()
      notify?.('success', 'Event gelöscht.')
      setEventToDelete(null)
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Event konnte nicht gelöscht werden.'))
    } finally {
      setDeletingEvent(false)
    }
  }

  return (
    <div className="grid two">
      <div className="card" data-testid="event-form-card" ref={formCardRef}>
        <h2>{editingEventId ? 'Event bearbeiten' : 'Event erstellen'}</h2>
        <p className="muted">
          Events werden zuerst intern gespeichert. Öffentlich sichtbar wird ein Event erst, wenn du
          es aktiv veröffentlichst.
        </p>

        <div className="row compact-wrap public-flow-summary">
          <span className="pill status-visibility-public">{visibleEvents.length} Öffentliche Events</span>
          <span className="pill status-visibility-internal">{hiddenEvents} Interne Events</span>
        </div>

        <form className="event-form" onSubmit={saveEvent}>
          <section className="form-section" data-testid="event-form-section-basics">
            <div className="form-section-header">
              <h3 className="form-section-title">Basisdaten</h3>
              <p className="form-section-hint">Diese Angaben brauchst du zum Speichern.</p>
            </div>
            <div
              className={`form-progress ${missingRequiredCount === 0 ? 'form-progress-complete' : ''}`}
              data-testid="event-form-required-progress"
            >
              <p className="form-section-hint">{requiredProgressText}</p>
              {missingRequiredCount > 0 && (
                <ul className="form-progress-list">
                  {missingRequiredFields.map(item => (
                    <li className="form-progress-item" key={item.key}>
                      {item.label} fehlt
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-section-grid">
              <div className="field-group">
                <label>Eventname *</label>
                <input
                  className={`input ${formErrors.title ? 'input-error' : ''}`}
                  data-testid="event-title"
                  placeholder="Eventname"
                  value={form.title}
                  onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
                />
                {formErrors.title && <p className="field-error">{formErrors.title}</p>}
              </div>

              <div className="form-grid form-section-grid-two">
                <div className="field-group">
                  <label>Datum *</label>
                  <input
                    className={`input ${formErrors.event_date ? 'input-error' : ''}`}
                    data-testid="event-date"
                    type="date"
                    value={form.event_date}
                    onChange={event => setForm(current => ({ ...current, event_date: event.target.value }))}
                  />
                  {formErrors.event_date && <p className="field-error">{formErrors.event_date}</p>}
                </div>

                <CityAutocomplete
                  error={formErrors.location_id}
                  locations={locations}
                  selectedLocationId={form.location_id}
                  setSelectedLocationId={location =>
                    setForm(current => ({ ...current, location_id: location?.id || '', location: location || null }))
                  }
                />
              </div>
            </div>
          </section>

          <section className="form-section form-section-public" data-testid="event-form-section-public">
            <div className="form-section-header">
              <div className="form-section-header-row">
                <h3 className="form-section-title">Öffentliche Angaben</h3>
                <span className="form-visibility-note form-note-public">Öffentlich sichtbar</span>
              </div>
              <p className="form-section-hint">Diese Angaben sehen Besucher später öffentlich.</p>
            </div>
            <div className="form-section-grid">
              <div className="field-group">
                <label>Öffentliche Beschreibung</label>
                <textarea
                  data-testid="event-public-description"
                  placeholder="Was Besucher über dieses Event wissen sollten"
                  value={form.public_description}
                  onChange={event => setForm(current => ({ ...current, public_description: event.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="form-section form-section-public" data-testid="event-form-section-times">
            <div className="form-section-header">
              <div className="form-section-header-row">
                <h3 className="form-section-title">Zeiten</h3>
                <span className="form-visibility-note form-note-public">Öffentlich sichtbar</span>
              </div>
              <p className="form-section-hint">
                Optional, helfen Besuchern bei der Planung. Wird öffentlich angezeigt, wenn ausgefüllt.
              </p>
            </div>
            <div className="form-grid form-section-grid-two">
              <div className="field-group">
                <label>Öffnung von</label>
                <input
                  className="input"
                  data-testid="event-opening-time"
                  type="time"
                  value={form.opening_time}
                  onChange={event => setForm(current => ({ ...current, opening_time: event.target.value }))}
                />
              </div>

              <div className="field-group">
                <label>Öffnung bis</label>
                <input
                  className="input"
                  data-testid="event-closing-time"
                  type="time"
                  value={form.closing_time}
                  onChange={event => setForm(current => ({ ...current, closing_time: event.target.value }))}
                />
              </div>
            </div>
            <p className="field-hint" data-testid="event-times-hint">
              Leer lassen, wenn noch nicht bekannt.
            </p>
          </section>

          <section className="form-section form-section-public" data-testid="event-form-section-equipment">
            <div className="form-section-header">
              <div className="form-section-header-row">
                <h3 className="form-section-title">Ausstattung</h3>
                <span className="form-visibility-note form-note-public">Öffentlich relevant</span>
              </div>
              <p className="form-section-hint">
                Diese Fakten können später auf der öffentlichen Eventseite helfen. Nur auswählen, was wirklich
                zutrifft.
              </p>
            </div>
            <div className="checkbox-grid">
              <label className="checkbox-row">
                <input
                  checked={Boolean(form.is_indoor)}
                  data-testid="event-is-indoor"
                  onChange={event => setForm(current => ({ ...current, is_indoor: event.target.checked }))}
                  type="checkbox"
                />
                <span>Indoor</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={Boolean(form.is_outdoor)}
                  data-testid="event-is-outdoor"
                  onChange={event => setForm(current => ({ ...current, is_outdoor: event.target.checked }))}
                  type="checkbox"
                />
                <span>Outdoor</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={Boolean(form.is_covered)}
                  data-testid="event-is-covered"
                  onChange={event => setForm(current => ({ ...current, is_covered: event.target.checked }))}
                  type="checkbox"
                />
                <span>Überdacht</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={Boolean(form.is_accessible)}
                  data-testid="event-is-accessible"
                  onChange={event => setForm(current => ({ ...current, is_accessible: event.target.checked }))}
                  type="checkbox"
                />
                <span>Barrierefrei</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={Boolean(form.has_parking)}
                  data-testid="event-has-parking"
                  onChange={event => setForm(current => ({ ...current, has_parking: event.target.checked }))}
                  type="checkbox"
                />
                <span>Parken</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={Boolean(form.has_toilets)}
                  data-testid="event-has-toilets"
                  onChange={event => setForm(current => ({ ...current, has_toilets: event.target.checked }))}
                  type="checkbox"
                />
                <span>WC</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={Boolean(form.has_food)}
                  data-testid="event-has-food"
                  onChange={event => setForm(current => ({ ...current, has_food: event.target.checked }))}
                  type="checkbox"
                />
                <span>Gastronomie</span>
              </label>
            </div>
          </section>

          <section className="form-section form-section-internal" data-testid="event-form-section-internal">
            <div className="form-section-header">
              <div className="form-section-header-row">
                <h3 className="form-section-title">Interne Angaben</h3>
                <span className="form-visibility-note form-note-internal">Nur intern sichtbar</span>
              </div>
              <p className="form-section-hint">Nur für deine Organisation sichtbar. Besucher sehen diese Notiz nicht.</p>
            </div>
            <div className="form-section-grid">
              <div className="field-group">
                <label>Interne Beschreibung</label>
                <textarea
                  data-testid="event-description"
                  placeholder="Interne Beschreibung"
                  value={form.description}
                  onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="form-section form-section-internal" data-testid="event-form-section-exhibitor-info">
            <div className="form-section-header">
              <div className="form-section-header-row">
                <h3 className="form-section-title">Aufbau &amp; Abbau</h3>
                <span className="form-visibility-note form-note-internal">Nur intern sichtbar</span>
              </div>
              <p className="form-section-hint">
                Intern für die Ausstellerinfo. Leer lassen, wenn noch nicht bekannt.
              </p>
            </div>
            <div className="form-grid form-section-grid-two">
              <div className="field-group">
                <label>Aufbau von</label>
                <input
                  className="input"
                  data-testid="event-setup-start-time"
                  type="time"
                  value={form.setup_start_time}
                  onChange={event => setForm(current => ({ ...current, setup_start_time: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Aufbau bis</label>
                <input
                  className="input"
                  data-testid="event-setup-end-time"
                  type="time"
                  value={form.setup_end_time}
                  onChange={event => setForm(current => ({ ...current, setup_end_time: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Abbau von</label>
                <input
                  className="input"
                  data-testid="event-teardown-start-time"
                  type="time"
                  value={form.teardown_start_time}
                  onChange={event => setForm(current => ({ ...current, teardown_start_time: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Abbau bis</label>
                <input
                  className="input"
                  data-testid="event-teardown-end-time"
                  type="time"
                  value={form.teardown_end_time}
                  onChange={event => setForm(current => ({ ...current, teardown_end_time: event.target.value }))}
                />
              </div>
            </div>
            <p className="field-hint" data-testid="event-setup-teardown-hint">
              Zeiten beziehen sich aktuell auf den Eventtag – mehrtägige Events und Aufbau am Vortag folgen separat.
            </p>
          </section>

          <section className="form-section form-section-internal" data-testid="event-form-section-arrival">
            <div className="form-section-header">
              <div className="form-section-header-row">
                <h3 className="form-section-title">Anreise &amp; Zugang</h3>
                <span className="form-visibility-note form-note-internal">Nur intern sichtbar</span>
              </div>
              <p className="form-section-hint">
                Diese Angaben bleiben intern und dienen der späteren Ausstellerinfo.
              </p>
            </div>
            <div className="form-section-grid">
              <div className="field-group">
                <label>Anfahrtshinweise</label>
                <textarea
                  data-testid="event-arrival-notes"
                  placeholder="Hinweise zur Anfahrt für Aussteller"
                  value={form.arrival_notes}
                  onChange={event => setForm(current => ({ ...current, arrival_notes: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Einfahrt / Zufahrt</label>
                <textarea
                  data-testid="event-access-notes"
                  placeholder="Zufahrt, Tor oder Einfahrt"
                  value={form.access_notes}
                  onChange={event => setForm(current => ({ ...current, access_notes: event.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="form-section form-section-internal" data-testid="event-form-section-contacts">
            <div className="form-section-header">
              <div className="form-section-header-row">
                <h3 className="form-section-title">Kontakt vor Ort</h3>
                <span className="form-visibility-note form-note-internal">Nur intern sichtbar</span>
              </div>
              <p className="form-section-hint">
                Diese Angaben bleiben intern und dienen der späteren Ausstellerinfo.
              </p>
            </div>
            <div className="form-grid form-section-grid-two">
              <div className="field-group">
                <label>Ansprechpartner vor Ort</label>
                <input
                  className="input"
                  data-testid="event-exhibitor-contact-name"
                  placeholder="Name Ansprechpartner"
                  value={form.exhibitor_contact_name}
                  onChange={event => setForm(current => ({ ...current, exhibitor_contact_name: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Telefon Ansprechpartner</label>
                <input
                  className="input"
                  data-testid="event-exhibitor-contact-phone"
                  placeholder="Telefonnummer"
                  value={form.exhibitor_contact_phone}
                  onChange={event => setForm(current => ({ ...current, exhibitor_contact_phone: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Notfallkontakt</label>
                <input
                  className="input"
                  data-testid="event-emergency-contact-name"
                  placeholder="Name Notfallkontakt"
                  value={form.emergency_contact_name}
                  onChange={event => setForm(current => ({ ...current, emergency_contact_name: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Telefon Notfallkontakt</label>
                <input
                  className="input"
                  data-testid="event-emergency-contact-phone"
                  placeholder="Telefonnummer"
                  value={form.emergency_contact_phone}
                  onChange={event => setForm(current => ({ ...current, emergency_contact_phone: event.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="form-section form-section-internal" data-testid="event-form-section-logistics">
            <div className="form-section-header">
              <div className="form-section-header-row">
                <h3 className="form-section-title">Optionale Logistikhinweise</h3>
                <span className="form-visibility-note form-note-internal">Nur intern sichtbar</span>
              </div>
              <p className="form-section-hint">
                Diese Angaben bleiben intern und dienen der späteren Ausstellerinfo.
              </p>
            </div>
            <div className="form-section-grid">
              <div className="field-group">
                <label>Stromhinweise</label>
                <textarea
                  data-testid="event-power-notes"
                  placeholder="Strom, Anschlüsse oder Besonderheiten"
                  value={form.power_notes}
                  onChange={event => setForm(current => ({ ...current, power_notes: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Parkhinweise</label>
                <textarea
                  data-testid="event-parking-notes"
                  placeholder="Parken für Aussteller"
                  value={form.parking_notes}
                  onChange={event => setForm(current => ({ ...current, parking_notes: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Müll / Entsorgung</label>
                <textarea
                  data-testid="event-waste-notes"
                  placeholder="Entsorgung und Abfallhinweise"
                  value={form.waste_notes}
                  onChange={event => setForm(current => ({ ...current, waste_notes: event.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Weitere Hinweise für Aussteller</label>
                <textarea
                  data-testid="event-general-exhibitor-notes"
                  placeholder="Weitere interne Hinweise für Aussteller"
                  value={form.exhibitor_general_notes}
                  onChange={event =>
                    setForm(current => ({ ...current, exhibitor_general_notes: event.target.value }))
                  }
                />
              </div>
            </div>
          </section>

          <section className="form-section" data-testid="event-form-section-visibility">
            <div className="form-section-header">
              <h3 className="form-section-title">Sichtbarkeit &amp; Speichern</h3>
              <p className="form-section-hint">Speichern ist der sichere Standard. Veröffentlichen bleibt ein bewusster nächster Schritt.</p>
            </div>
            <div className="form-actions-panel" data-testid="event-form-actions-panel">
              <div className="form-progress" data-testid="event-form-visibility-help">
                <p className="form-action-note">
                  Speichern sichert deine Änderungen. Öffentlich sichtbar wird das Event erst nach der
                  Veröffentlichung.
                </p>
                <p className="form-section-hint">
                  {editingEventId
                    ? 'Du kannst Änderungen speichern und das Event anschließend veröffentlichen, sofern alle Angaben vollständig sind.'
                    : 'Neue Events starten intern und sind noch nicht öffentlich sichtbar.'}
                </p>
                {eventIssues?.length > 0 && (
                  <p className="form-section-hint">Vor der Veröffentlichung fehlen noch Angaben.</p>
                )}
              </div>

              {eventIssues?.length > 0 && (
                <div className="data-quality form-completeness-note" data-testid="event-issues-panel">
                  <strong>Vollständigkeit vor Veröffentlichung</strong>
                  <p>{eventIssues.length} Event-Einträge brauchen noch Aufmerksamkeit:</p>
                  {eventIssues.map(event => (
                    <div className="quality-item" key={event.id} data-testid="event-issue-item">
                      <div>
                        <span>{event.title || 'Ohne Eventname'}</span>
                        <small>{event.problems.join(' · ')}</small>
                      </div>
                      <div className="event-issue-actions">
                        <button
                          className="btn ghost"
                          data-testid="issue-edit-event"
                          onClick={() => editEvent(event)}
                          type="button"
                        >
                          {event.location_id ? 'Bearbeiten' : 'Stadt zuweisen'}
                        </button>
                        <button
                          className="btn danger-outline"
                          data-testid="issue-delete-event"
                          onClick={() => setEventToDelete(event)}
                          type="button"
                        >
                          <Trash2 size={16} /> Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-section-grid">
                {editingEventId ? (
                  <label className="checkbox-row">
                    <input
                      checked={Boolean(form.public_visible)}
                      data-testid="event-public-visible"
                      onChange={event => setForm(current => ({ ...current, public_visible: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>Sichtbarkeit: {getEventVisibilityLabel({ public_visible: form.public_visible })}</span>
                  </label>
                ) : (
                  <div className="pill info-pill" data-testid="event-create-internal-note">
                    Neue Events starten intern.
                  </div>
                )}
              </div>

              <div className="form-actions-main">
                <button
                  className="btn sticky-save-button"
                  data-testid="save-event"
                  disabled={saving || loadingExhibitorInfo}
                >
                  <Plus size={16} />{' '}
                  {saving
                    ? 'Speichert...'
                    : loadingExhibitorInfo
                      ? 'Lädt...'
                      : editingEventId
                        ? 'Änderungen speichern'
                        : 'Als intern speichern'}
                </button>
              </div>

              <div className="form-actions-secondary">
                {editingEventId && !form.public_visible && (
                  <button
                    className="btn secondary"
                    data-testid="publish-event-form"
                    disabled={publishing}
                    onClick={() => updateEventVisibility(editingEvent || { id: editingEventId }, true)}
                    type="button"
                  >
                    <Globe size={16} /> {publishing ? 'Veröffentlicht...' : 'Jetzt veröffentlichen'}
                  </button>
                )}
                {editingEventId && (
                  <button className="btn ghost" onClick={resetForm} type="button">
                    Abbrechen
                  </button>
                )}
              </div>
            </div>
          </section>
        </form>

        {!editingEventId && (
          <p
            className="field-hint"
            data-testid="stand-pricing-new-event-hint"
            style={{ marginTop: 10 }}
          >
            Standflächen &amp; Preise können nach dem ersten Speichern des Events gepflegt werden.
          </p>
        )}

        {editingEventId && (
          <div className="event-import-section" data-testid="event-import-section" style={{ marginTop: 16 }}>
            {!importOpen ? (
              <button
                className="btn ghost"
                data-testid="event-import-btn"
                type="button"
                onClick={openImportDialog}
              >
                Daten aus vorherigem Event übernehmen
              </button>
            ) : (
              <div className="card" data-testid="event-import-dialog" style={{ padding: 16 }}>
                <h3 style={{ marginBottom: 4 }}>Daten aus Event übernehmen</h3>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Datum, Veröffentlichung und Status werden nicht übernommen.
                </p>
                <div className="field-group" style={{ marginBottom: 12 }}>
                  <label>Event auswählen</label>
                  {importEventsLoading ? (
                    <p className="muted">Lädt…</p>
                  ) : importEvents.length === 0 ? (
                    <p className="muted" data-testid="event-import-no-events">Keine anderen Events vorhanden.</p>
                  ) : (
                    <select
                      className="input"
                      data-testid="event-import-source-select"
                      value={importSourceId}
                      onChange={e => handleSourceChange(e.target.value)}
                    >
                      <option value="">– Event wählen –</option>
                      {importEvents.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.title || 'Ohne Eventname'}{e.event_date ? ` (${e.event_date})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="checkbox-grid" style={{ marginBottom: 8 }}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      data-testid="event-import-basics-checkbox"
                      checked={importBasics}
                      onChange={e => setImportBasics(e.target.checked)}
                    />
                    <span>Basisdaten übernehmen</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      data-testid="event-import-exhibitor-info-checkbox"
                      checked={importExhibitorInfo}
                      onChange={e => setImportExhibitorInfo(e.target.checked)}
                    />
                    <span>Ausstellerinfos übernehmen</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      data-testid="event-import-stand-pricing-checkbox"
                      checked={importStandPricing}
                      onChange={e => setImportStandPricing(e.target.checked)}
                    />
                    <span>Standflächen &amp; Preise übernehmen</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      data-testid="event-import-participants-checkbox"
                      checked={importParticipants}
                      onChange={e => {
                        const checked = e.target.checked
                        setImportParticipants(checked)
                        if (checked && importSourceId) {
                          loadSourceParticipants(importSourceId)
                        } else {
                          setSelectedParticipantIds(new Set())
                          setSourceParticipants([])
                        }
                      }}
                    />
                    <span>Aussteller / Teilnehmer übernehmen</span>
                  </label>
                </div>
                <p
                  className="field-hint"
                  data-testid="event-import-stand-pricing-hint"
                  style={{ marginBottom: 12 }}
                >
                  Kopierte Standflächen und Zusatzoptionen werden nicht automatisch öffentlich freigegeben.
                </p>

                {importParticipants && (
                  <div
                    className="field-group"
                    data-testid="event-import-participants-section"
                    style={{ marginBottom: 12 }}
                  >
                    {!importSourceId ? (
                      <p className="muted" style={{ fontSize: '0.9em' }}>
                        Bitte zuerst ein Quellevent auswählen.
                      </p>
                    ) : sourceParticipantsLoading ? (
                      <p className="muted" style={{ fontSize: '0.9em' }}>Lädt Teilnehmer…</p>
                    ) : sourceParticipants.length === 0 ? (
                      <p className="muted" data-testid="event-import-participants-empty" style={{ fontSize: '0.9em' }}>
                        Im Quellevent sind keine Teilnehmer hinterlegt.
                      </p>
                    ) : (
                      <>
                        <p
                          className="field-hint"
                          data-testid="event-import-participants-hint"
                          style={{ marginBottom: 8 }}
                        >
                          Ausgewählte Aussteller werden mit Status Angefragt und Zahlung offen übernommen.
                          Alte Zahlungen und Status werden nicht übernommen.
                        </p>
                        <div data-testid="event-import-participants-list">
                          {sourceParticipants.map(p => (
                            <label
                              key={p.id}
                              className="checkbox-row"
                              data-testid="event-import-participant-row"
                              style={{ alignItems: 'flex-start', marginBottom: 6 }}
                            >
                              <input
                                type="checkbox"
                                data-testid={`event-import-participant-check-${p.id}`}
                                checked={selectedParticipantIds.has(p.id)}
                                onChange={e => {
                                  const id = p.id
                                  setSelectedParticipantIds(prev => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(id)
                                    else next.delete(id)
                                    return next
                                  })
                                }}
                              />
                              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                                <strong>{p.exhibitor_name}</strong>
                                {p.email && (
                                  <span className="muted" style={{ fontSize: '0.85em' }}>{p.email}</span>
                                )}
                                <span
                                  className="pill"
                                  data-testid="event-import-participant-status"
                                  style={{ fontSize: '0.8em' }}
                                >
                                  {PARTICIPANT_STATUS_LABELS[p.status] ?? p.status}
                                </span>
                                <span
                                  className="pill"
                                  data-testid="event-import-participant-paid"
                                  style={{ fontSize: '0.8em' }}
                                >
                                  {p.paid ? 'Bezahlt' : 'Offen'}
                                </span>
                                {p.booth && (
                                  <span
                                    className="muted"
                                    data-testid="event-import-participant-booth"
                                    style={{ fontSize: '0.85em' }}
                                  >
                                    Stand: {p.booth}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="form-actions-secondary">
                  <button
                    className="btn"
                    data-testid="event-import-submit"
                    type="button"
                    disabled={importing || importEventsLoading || !importSourceId || (!importBasics && !importExhibitorInfo && !importStandPricing && !importParticipants)}
                    onClick={handleImport}
                  >
                    {importing ? 'Übernimmt…' : 'Daten übernehmen'}
                  </button>
                  <button
                    className="btn ghost"
                    data-testid="event-import-cancel"
                    type="button"
                    onClick={closeImportDialog}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {editingEventId && (
          <EventStandPricingSection
            eventId={editingEventId}
            notify={notify}
          />
        )}
      </div>

      <div className="card" data-testid="event-list-card">
        <div className="list-toolbar" data-testid="events-list-toolbar">
          <div className="list-toolbar-row">
            <div>
              <h2>Events</h2>
              <p className="list-result-count" data-testid="events-result-count">
                {resultCountText}
              </p>
            </div>
            {hasActiveEventListControls && (
              <button
                className="btn ghost"
                data-testid="events-reset-filters"
                onClick={resetEventListControls}
                type="button"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>

          <div className="list-toolbar-row list-toolbar-controls">
            <div className="field-group list-search">
              <label htmlFor="events-search">Suche</label>
              <input
                id="events-search"
                className="input"
                data-testid="events-search"
                placeholder="Nach Eventname oder Ort suchen"
                value={eventSearch}
                onChange={event => setEventSearch(event.target.value)}
              />
            </div>

            <div className="list-filter-group">
              <div className="field-group">
                <label htmlFor="events-visibility-filter">Sichtbarkeit</label>
                <select
                  id="events-visibility-filter"
                  data-testid="events-visibility-filter"
                  value={visibilityFilter}
                  onChange={event => setVisibilityFilter(event.target.value)}
                >
                  <option value="alle">Alle</option>
                  <option value="oeffentlich">Öffentlich</option>
                  <option value="intern">Intern</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="events-sort-order">Sortierung</label>
                <select
                  id="events-sort-order"
                  data-testid="events-sort-order"
                  value={sortOrder}
                  onChange={event => setSortOrder(event.target.value)}
                >
                  <option value="upcoming">Nächste zuerst</option>
                  <option value="latest">Späteste zuerst</option>
                  <option value="name-asc">Name A–Z</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="event-card-list">
          {events.length === 0 ? (
            <div className="list-empty-state" data-testid="events-empty-state">
              <strong>Noch keine Events angelegt.</strong>
            </div>
          ) : filteredAndSortedEvents.length === 0 ? (
            <div className="list-empty-state" data-testid="events-no-results">
              <strong>Keine Events gefunden.</strong>
              <p className="muted">Ändere die Suche oder setze die Filter zurück.</p>
              {hasActiveEventListControls && (
                <button
                  className="btn ghost"
                  data-testid="events-empty-reset"
                  onClick={resetEventListControls}
                  type="button"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          ) : (
            filteredAndSortedEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                issue={eventIssues?.find(issue => issue.id === event.id)}
                onDelete={setEventToDelete}
                onEdit={editEvent}
                onOpen={openEventDetail}
                onTogglePublish={updateEventVisibility}
              />
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        busy={deletingEvent}
        message={`"${eventToDelete?.title || 'Ohne Eventname'}" wird mit zugehörigen Teilnehmern, ToDos und Mitteilungen entfernt.`}
        onCancel={() => setEventToDelete(null)}
        onConfirm={confirmDeleteEvent}
        open={Boolean(eventToDelete)}
        testId="delete-event-modal"
        title="Event wirklich löschen?"
      />

      <ConfirmModal
        busy={importing}
        confirmLabel="Überschreiben"
        message="Dieses Event hat bereits Ausstellerinfos. Diese werden mit den Daten aus dem gewählten Event überschrieben."
        onCancel={() => setImportOverwriteConfirm(false)}
        onConfirm={doImport}
        open={importOverwriteConfirm}
        testId="import-overwrite-modal"
        title="Ausstellerinfos überschreiben?"
      />

      <ConfirmModal
        busy={importing}
        confirmLabel="Trotzdem importieren"
        message="Dieses Event hat bereits Standflächen oder Zusatzoptionen. Die importierten Daten werden zusätzlich hinzugefügt, nicht ersetzt."
        onCancel={() => setImportStandOverwriteConfirm(false)}
        onConfirm={doImport}
        open={importStandOverwriteConfirm}
        testId="import-stand-overwrite-modal"
        title="Standdaten ergänzen?"
      />
    </div>
  )
}
