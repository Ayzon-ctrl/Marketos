import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Globe, MapPin, Plus } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { fmtDate, getEventVisibilityLabel, hasEventQualityIssues } from '../../lib/eventUtils'
import { getUserErrorMessage } from '../../lib/userError'
import {
  getParticipantStatusErrorMessage,
  getParticipantStatusLabel,
  getParticipantStatusSummary
} from '../../lib/participantUtils'
import { persistTaskMeta } from '../../lib/taskUtils'
import ConfirmModal from '../ConfirmModal'
import EventExhibitorInfoSection from '../event-detail/EventExhibitorInfoSection'
import EventMessagesSection from '../event-detail/EventMessagesSection'
import EventParticipantsSection from '../event-detail/EventParticipantsSection'
import EventTasksSection from '../event-detail/EventTasksSection'

function createParticipantForm() {
  return {
    exhibitor_name: '',
    email: '',
    booth: '',
    paid: false,
    status: 'angefragt',
    linked_vendor_profile_id: ''
  }
}

export default function EventDetailView({
  selectedEvent,
  participants,
  tasks,
  announcements,
  publicUpdates,
  profile,
  taskSchemaReady,
  notify,
  reload,
  closeEventDetail,
  openEventEditor,
  openParticipantsView,
  linkableVendors = []
}) {
  const [participantForm, setParticipantForm] = useState(createParticipantForm())
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', priority: 'medium', scope: 'team' })
  const [messageForm, setMessageForm] = useState({ title: '', body: '', pinned: false })
  const [updateForm, setUpdateForm] = useState({ title: '', body: '', public_visible: true })
  const [busy, setBusy] = useState({ participant: false, task: false, message: false, update: false })
  const [editingParticipantId, setEditingParticipantId] = useState('')
  const [participantFilter, setParticipantFilter] = useState('alle')
  const [participantToDelete, setParticipantToDelete] = useState(null)
  const [deletingParticipant, setDeletingParticipant] = useState(false)
  const [exhibitorInfo, setExhibitorInfo] = useState(null)
  const [standPricing, setStandPricing] = useState({ options: [], tiers: [], addons: [] })
  const [publishing, setPublishing] = useState(false)
  const [pendingScrollTarget, setPendingScrollTarget] = useState('')

  useEffect(() => {
    let active = true

    async function loadEventExhibitorInfo(eventId) {
      try {
        const { data, error } = await supabase
          .from('event_exhibitor_info')
          .select(
            'setup_start_time,setup_end_time,teardown_start_time,teardown_end_time,arrival_notes,access_notes,exhibitor_contact_name,exhibitor_contact_phone,emergency_contact_name,emergency_contact_phone,power_notes,parking_notes,waste_notes,exhibitor_general_notes'
          )
          .eq('event_id', eventId)
          .maybeSingle()

        if (error) throw error
        if (active) setExhibitorInfo(data || null)
      } catch (err) {
        if (active) setExhibitorInfo(null)
        notify?.('error', getUserErrorMessage(err, 'Ausstellerinfos konnten nicht geladen werden.'))
      }
    }

    if (!selectedEvent?.id) {
      setExhibitorInfo(null)
      return () => {
        active = false
      }
    }

    setExhibitorInfo(null)
    loadEventExhibitorInfo(selectedEvent.id)

    return () => {
      active = false
    }
  }, [notify, selectedEvent?.id])

  useEffect(() => {
    let active = true

    async function loadStandPricing(eventId) {
      try {
        const [optResult, addonResult] = await Promise.all([
          supabase
            .from('event_stand_options')
            .select('*')
            .eq('event_id', eventId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('event_addon_options')
            .select('*')
            .eq('event_id', eventId)
            .order('sort_order', { ascending: true })
        ])
        if (!active) return
        if (optResult.error) throw optResult.error
        if (addonResult.error) throw addonResult.error

        const options = optResult.data || []
        const tieredIds = options
          .filter(o => o.pricing_type === 'tiered_length')
          .map(o => o.id)

        let tiers = []
        if (tieredIds.length > 0) {
          const { data: tierData, error: tierError } = await supabase
            .from('event_stand_price_tiers')
            .select('*')
            .in('stand_option_id', tieredIds)
            .order('sort_order', { ascending: true })
          if (!active) return
          if (tierError) throw tierError
          tiers = tierData || []
        }

        if (active) {
          setStandPricing({ options, tiers, addons: addonResult.data || [] })
        }
      } catch (err) {
        if (active) {
          setStandPricing({ options: [], tiers: [], addons: [] })
          notify?.('error', getUserErrorMessage(err, 'Preisvorschau konnte nicht geladen werden.'))
        }
      }
    }

    if (!selectedEvent?.id) {
      setStandPricing({ options: [], tiers: [], addons: [] })
      return () => {
        active = false
      }
    }

    setStandPricing({ options: [], tiers: [], addons: [] })
    loadStandPricing(selectedEvent.id)

    return () => {
      active = false
    }
  }, [notify, selectedEvent?.id])

  const eventParticipants = useMemo(
    () => participants.filter(participant => participant.event_id === selectedEvent?.id),
    [participants, selectedEvent]
  )
  const participantSummary = useMemo(() => getParticipantStatusSummary(eventParticipants), [eventParticipants])
  const filteredEventParticipants = useMemo(() => {
    if (participantFilter === 'alle') return eventParticipants
    if (participantFilter === 'bezahlt') return eventParticipants.filter(participant => participant.paid)
    if (participantFilter === 'offen') return eventParticipants.filter(participant => !participant.paid)

    return eventParticipants.filter(
      participant =>
        (participant.status || (participant.paid ? 'bestaetigt' : 'angefragt')) === participantFilter
    )
  }, [eventParticipants, participantFilter])
  const eventTasks = useMemo(() => tasks.filter(task => task.event_id === selectedEvent?.id), [tasks, selectedEvent])
  const eventAnnouncements = useMemo(
    () => announcements.filter(item => item.event_id === selectedEvent?.id),
    [announcements, selectedEvent]
  )
  const eventPublicUpdates = useMemo(
    () => publicUpdates.filter(item => item.event_id === selectedEvent?.id),
    [publicUpdates, selectedEvent]
  )

  useEffect(() => {
    if (!pendingScrollTarget) return

    const frameId = window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-testid="event-detail-${pendingScrollTarget}"]`)
      if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' })
      setPendingScrollTarget('')
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [eventTasks.length, pendingScrollTarget])

  if (!selectedEvent) {
    return (
      <div className="card" data-testid="event-detail-empty">
        <h2>Event nicht gefunden</h2>
        <p className="muted">Das gewählte Event ist nicht mehr vorhanden oder wurde noch nicht geladen.</p>
        <button className="btn secondary" onClick={closeEventDetail} type="button">
          <ArrowLeft size={16} /> Zurück zu Events
        </button>
      </div>
    )
  }

  function resetParticipantForm() {
    setParticipantForm(createParticipantForm())
    setEditingParticipantId('')
  }

  function editParticipant(participant) {
    const linkedVendor = linkableVendors.find(vendor => vendor.owner_id === participant.exhibitor_id)

    setEditingParticipantId(participant.id)
    setParticipantForm({
      exhibitor_name: participant.exhibitor_name || '',
      email: participant.email || '',
      booth: participant.booth || '',
      paid: Boolean(participant.paid),
      status: participant.status || (participant.paid ? 'bestaetigt' : 'angefragt'),
      linked_vendor_profile_id: linkedVendor?.id || ''
    })
    notify?.('success', 'Teilnehmer zum Bearbeiten geladen.')
  }

  function handleEditEvent() {
    if (!selectedEvent?.id) return
    openEventEditor?.(selectedEvent)
  }

  async function addParticipant(event) {
    event.preventDefault()
    if (busy.participant) return

    const exhibitorName = participantForm.exhibitor_name.trim()
    if (!exhibitorName) {
      notify?.('error', 'Bitte gib einen Teilnehmernamen ein.')
      return
    }

    const linkedVendor = linkableVendors.find(vendor => vendor.id === participantForm.linked_vendor_profile_id)

    setBusy(current => ({ ...current, participant: true }))
    try {
      const payload = {
        event_id: selectedEvent.id,
        exhibitor_name: exhibitorName,
        email: participantForm.email.trim() || null,
        booth: participantForm.booth.trim() || null,
        paid: participantForm.paid,
        status: participantForm.status || 'angefragt',
        exhibitor_id: linkedVendor?.owner_id || null
      }

      const { error } = editingParticipantId
        ? await supabase.from('event_participants').update(payload).eq('id', editingParticipantId)
        : await supabase.from('event_participants').insert(payload)

      if (error) throw error

      resetParticipantForm()
      await reload()
      notify?.(
        'success',
        editingParticipantId
          ? 'Teilnehmer aktualisiert.'
          : linkedVendor
            ? 'Teilnehmer verknüpft und zum Event hinzugefügt.'
            : 'Teilnehmer zum Event hinzugefügt.'
      )
    } catch (err) {
      notify?.('error', `Teilnehmer konnte nicht gespeichert werden: ${getParticipantStatusErrorMessage(err)}`)
    } finally {
      setBusy(current => ({ ...current, participant: false }))
    }
  }

  async function updateParticipantStatus(participant, status) {
    try {
      const { error } = await supabase.from('event_participants').update({ status }).eq('id', participant.id)
      if (error) throw error
      await reload()
      notify?.('success', `Teilnehmerstatus auf "${getParticipantStatusLabel(status)}" gesetzt.`)
    } catch (err) {
      notify?.('error', `Teilnehmerstatus konnte nicht gespeichert werden: ${getParticipantStatusErrorMessage(err)}`)
    }
  }

  async function toggleParticipantPaid(participant) {
    try {
      const nextPaid = !participant.paid
      const nextStatus =
        participant.status === 'abgesagt'
          ? 'abgesagt'
          : nextPaid
            ? 'bestaetigt'
            : participant.status || 'angefragt'

      const { error } = await supabase
        .from('event_participants')
        .update({ paid: nextPaid, status: nextStatus })
        .eq('id', participant.id)

      if (error) throw error
      await reload()
      notify?.('success', nextPaid ? 'Teilnehmer als bezahlt markiert.' : 'Zahlungsstatus auf offen gesetzt.')
    } catch (err) {
      notify?.('error', `Zahlungsstatus konnte nicht aktualisiert werden: ${getParticipantStatusErrorMessage(err)}`)
    }
  }

  async function confirmDeleteParticipant() {
    if (!participantToDelete) return

    setDeletingParticipant(true)
    try {
      const { error } = await supabase.from('event_participants').delete().eq('id', participantToDelete.id)
      if (error) throw error
      if (editingParticipantId === participantToDelete.id) resetParticipantForm()
      await reload()
      notify?.('success', 'Teilnehmer gelöscht.')
      setParticipantToDelete(null)
    } catch (err) {
      notify?.('error', `Teilnehmer konnte nicht gelöscht werden: ${getParticipantStatusErrorMessage(err)}`)
    } finally {
      setDeletingParticipant(false)
    }
  }

  async function addTask(event) {
    event.preventDefault()
    if (busy.task) return

    const title = taskForm.title.trim()
    if (!title) {
      notify?.('error', 'Bitte gib eine Aufgabe ein.')
      return
    }

    setBusy(current => ({ ...current, task: true }))
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          owner_id: profile.id,
          event_id: selectedEvent.id,
          title,
          due_date: taskForm.due_date || null,
          ...(taskSchemaReady ? { priority: taskForm.priority, scope: taskForm.scope } : {})
        })
        .select()
        .single()

      if (error) throw error
      if (!taskSchemaReady && data?.id) {
        persistTaskMeta(data.id, { priority: taskForm.priority, scope: taskForm.scope })
      }

      setTaskForm({ title: '', due_date: '', priority: 'medium', scope: 'team' })
      setPendingScrollTarget('tasks')
      await reload()
      notify?.('success', 'ToDo zum Event gespeichert.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'ToDo konnte nicht gespeichert werden.'))
    } finally {
      setBusy(current => ({ ...current, task: false }))
    }
  }

  async function toggleTask(task) {
    try {
      const { error } = await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)
      if (error) throw error
      await reload()
      notify?.('success', 'ToDo aktualisiert.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'ToDo konnte nicht aktualisiert werden.'))
    }
  }

  async function addMessage(event) {
    event.preventDefault()
    if (busy.message) return

    const title = messageForm.title.trim()
    const body = messageForm.body.trim()

    if (!title || !body) {
      notify?.('error', 'Titel und Nachricht sind Pflichtfelder.')
      return
    }

    setBusy(current => ({ ...current, message: true }))
    try {
      const { error } = await supabase.from('announcements').insert({
        event_id: selectedEvent.id,
        author_id: profile.id,
        title,
        body,
        pinned: messageForm.pinned
      })

      if (error) throw error

      setMessageForm({ title: '', body: '', pinned: false })
      await reload()
      notify?.('success', 'Mitteilung zum Event veröffentlicht.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Mitteilung konnte nicht gespeichert werden.'))
    } finally {
      setBusy(current => ({ ...current, message: false }))
    }
  }

  async function addPublicUpdate(event) {
    event.preventDefault()
    if (busy.update) return

    const title = updateForm.title.trim()
    const body = updateForm.body.trim()
    if (!title || !body) {
      notify?.('error', 'Titel und Text für das öffentliche Update sind Pflicht.')
      return
    }

    setBusy(current => ({ ...current, update: true }))
    try {
      const { error } = await supabase.from('public_updates').insert({
        author_id: profile.id,
        event_id: selectedEvent.id,
        title,
        body,
        public_visible: Boolean(updateForm.public_visible)
      })

      if (error) throw error
      setUpdateForm({ title: '', body: '', public_visible: true })
      await reload()
      notify?.('success', 'Öffentliches Event-Update gespeichert.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Update konnte nicht gespeichert werden.'))
    } finally {
      setBusy(current => ({ ...current, update: false }))
    }
  }

  async function updateEventVisibility(nextVisible) {
    if (!selectedEvent?.id || publishing) return

    setPublishing(true)
    try {
      const { error } = await supabase
        .from('events')
        .update({ public_visible: nextVisible })
        .eq('id', selectedEvent.id)

      if (error) throw error

      await reload()
      notify?.(
        'success',
        nextVisible
          ? 'Event veröffentlicht. Es ist jetzt auf Landingpage und Märkten sichtbar.'
          : 'Event ist jetzt wieder intern.'
      )
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Sichtbarkeit konnte nicht gespeichert werden.'))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="grid" data-testid="event-detail-view">
      <div className="card event-detail-hero">
        <div className="event-detail-header">
          <div>
            <button className="btn ghost event-detail-back" data-testid="back-to-events" onClick={closeEventDetail} type="button">
              <ArrowLeft size={16} /> Zurück zu Events
            </button>
            <h2 data-testid="event-detail-title">{selectedEvent.title || 'Ohne Eventname'}</h2>
            <div className="event-detail-meta">
              <span>
                <CalendarDays size={16} /> {fmtDate(selectedEvent.event_date)}
              </span>
              <span>
                <MapPin size={16} /> {selectedEvent.location || 'Stadt offen'}
              </span>
              <span
                className={`pill ${selectedEvent.public_visible ? 'status-visibility-public' : 'status-visibility-internal'}`}
                data-testid="event-detail-visibility"
              >
                <Globe size={14} /> {getEventVisibilityLabel(selectedEvent)}
              </span>
              {hasEventQualityIssues(selectedEvent) && <span className="pill status-quality-review">Prüfung nötig</span>}
            </div>
          </div>
          <div className="event-detail-summary">
            <div>
              <strong>{eventParticipants.length}</strong>
              <span>Teilnehmer</span>
            </div>
            <div>
              <strong>{eventTasks.filter(task => !task.done).length}</strong>
              <span>Offene ToDos</span>
            </div>
            <div>
              <strong>{eventAnnouncements.length}</strong>
              <span>Mitteilungen</span>
            </div>
          </div>
        </div>
        <div className="row compact-wrap event-detail-action-row" data-testid="event-detail-actions">
          <button
            className="btn secondary"
            data-testid="event-detail-edit-event"
            onClick={handleEditEvent}
            type="button"
          >
            Event bearbeiten
          </button>
          {!selectedEvent.public_visible ? (
            <button
              className="btn secondary"
              data-testid="event-detail-publish"
              disabled={publishing}
              onClick={() => updateEventVisibility(true)}
              type="button"
            >
              <Globe size={16} /> {publishing ? 'Veröffentlicht...' : 'Veröffentlichen'}
            </button>
          ) : (
            <button
              className="btn ghost"
              data-testid="event-detail-unpublish"
              disabled={publishing}
              onClick={() => updateEventVisibility(false)}
              type="button"
            >
              <Globe size={16} /> {publishing ? 'Speichert...' : 'Veröffentlichung zurücknehmen'}
            </button>
          )}
        </div>
        <p className="muted event-detail-description">
          {selectedEvent.public_description || selectedEvent.description || 'Dieses Event braucht noch einen verständlichen Beschreibungstext.'}
        </p>
        <button
          className="btn ghost promotion-info-button"
          data-testid="event-promotion-info"
          onClick={() =>
            notify?.('success', 'Event-Hervorhebungen werden später als bezahlte Option verfügbar.')
          }
          type="button"
        >
          Event hervorheben - demnächst verfügbar
        </button>
      </div>

      <div className="grid three detail-columns">
        <EventParticipantsSection
          addParticipant={addParticipant}
          busyParticipant={busy.participant}
          editParticipant={editParticipant}
          editingParticipantId={editingParticipantId}
          filteredEventParticipants={filteredEventParticipants}
          linkableVendors={linkableVendors}
          openParticipantsView={openParticipantsView}
          participantFilter={participantFilter}
          participantForm={participantForm}
          participantSummary={participantSummary}
          resetParticipantForm={resetParticipantForm}
          selectedEvent={selectedEvent}
          setParticipantFilter={setParticipantFilter}
          setParticipantForm={setParticipantForm}
          setParticipantToDelete={setParticipantToDelete}
          toggleParticipantPaid={toggleParticipantPaid}
          updateParticipantStatus={updateParticipantStatus}
        />

        <EventTasksSection
          addTask={addTask}
          busyTask={busy.task}
          eventTasks={eventTasks}
          setTaskForm={setTaskForm}
          taskForm={taskForm}
          taskSchemaReady={taskSchemaReady}
          toggleTask={toggleTask}
        />

        <EventMessagesSection
          addMessage={addMessage}
          busyMessage={busy.message}
          eventAnnouncements={eventAnnouncements}
          messageForm={messageForm}
          setMessageForm={setMessageForm}
        />
      </div>

      <EventExhibitorInfoSection
        addonOptions={standPricing.addons}
        exhibitorInfo={exhibitorInfo}
        notify={notify}
        onEditEvent={handleEditEvent}
        participants={eventParticipants}
        priceTiers={standPricing.tiers}
        selectedEvent={selectedEvent}
        standOptions={standPricing.options}
      />

      <div className="card" data-testid="event-public-updates-section">
        <div className="row space-between">
          <div>
            <h2>Öffentliche Updates</h2>
            <p className="muted">Diese Hinweise landen direkt auf der Eventseite und erzeugen neue Einträge für Favoriten.</p>
          </div>
          <span className="pill info-pill">{eventPublicUpdates.length} sichtbar</span>
        </div>

        <form className="event-form" onSubmit={addPublicUpdate}>
          <div className="field-group">
            <label>Titel</label>
            <input
              className="input"
              data-testid="event-update-title"
              value={updateForm.title}
              onChange={event => setUpdateForm(current => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="field-group">
            <label>Text</label>
            <textarea
              data-testid="event-update-body"
              value={updateForm.body}
              onChange={event => setUpdateForm(current => ({ ...current, body: event.target.value }))}
            />
          </div>
          <label className="checkbox-row">
            <input
              checked={Boolean(updateForm.public_visible)}
              data-testid="event-update-visible"
              onChange={event => setUpdateForm(current => ({ ...current, public_visible: event.target.checked }))}
              type="checkbox"
            />
            <span>Öffentlich sichtbar</span>
          </label>
          <button className="btn secondary" data-testid="event-save-update" disabled={busy.update}>
            <Plus size={16} /> {busy.update ? 'Speichert...' : 'Update veröffentlichen'}
          </button>
        </form>

        <div className="list">
          {eventPublicUpdates.length === 0 && (
            <p className="muted">Noch keine öffentlichen Updates für dieses Event.</p>
          )}
          {eventPublicUpdates.map(update => (
            <div className="item" key={update.id}>
              <strong>{update.title}</strong>
              <p className="muted">{update.body}</p>
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        busy={deletingParticipant}
        message={`"${participantToDelete?.exhibitor_name || 'Ohne Namen'}" wird aus diesem Event entfernt.`}
        onCancel={() => setParticipantToDelete(null)}
        onConfirm={confirmDeleteParticipant}
        open={Boolean(participantToDelete)}
        testId="delete-participant-modal"
        title="Teilnehmer wirklich löschen?"
      />
    </div>
  )
}
