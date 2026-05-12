import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import {
  getParticipantStatusClass,
  getParticipantStatusErrorMessage,
  getParticipantStatusLabel,
  getParticipantStatusSummary,
  participantFilterOptions,
  participantStatusOptions
} from '../../lib/participantUtils'

const PARTICIPANT_SORT_PRIORITY = {
  angefragt: 0,
  warteliste: 1,
  bestaetigt: 2,
  abgesagt: 3
}

function getEffectiveParticipantStatus(participant) {
  return participant.status || (participant.paid ? 'bestaetigt' : 'angefragt')
}

export default function ParticipantsView({
  participants,
  events,
  reload,
  notify,
  roleView,
  exhibitorParticipants,
  exhibitorEvents,
  participantViewFilter,
  setParticipantViewFilter,
  participantViewEventId,
  setParticipantViewEventId
}) {
  const [form, setForm] = useState({
    event_id: '',
    exhibitor_name: '',
    email: '',
    booth: '',
    paid: false,
    status: 'angefragt'
  })
  const [participantSearch, setParticipantSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('status-open-first')

  const sourceParticipants = roleView === 'exhibitor' ? exhibitorParticipants : participants
  const sourceEvents = roleView === 'exhibitor' ? exhibitorEvents : events
  const eventTitleById = useMemo(
    () => new Map((sourceEvents || []).map(event => [event.id, event.title || 'Ohne Eventname'])),
    [sourceEvents]
  )
  const filteredByStatusParticipants = useMemo(() => {
    if (participantViewFilter === 'alle') return sourceParticipants
    if (participantViewFilter === 'bezahlt') return sourceParticipants.filter(participant => participant.paid)
    if (participantViewFilter === 'offen') return sourceParticipants.filter(participant => !participant.paid)

    return sourceParticipants.filter(
      participant => getEffectiveParticipantStatus(participant) === participantViewFilter
    )
  }, [participantViewFilter, sourceParticipants])

  const participantSummaryForEvent = useMemo(() => {
    const eventScopedParticipants = participantViewEventId
      ? sourceParticipants.filter(participant => participant.event_id === participantViewEventId)
      : sourceParticipants

    return getParticipantStatusSummary(eventScopedParticipants)
  }, [participantViewEventId, sourceParticipants])

  const normalizedParticipantSearch = participantSearch.trim().toLowerCase()
  const filteredParticipants = useMemo(() => {
    const visibleParticipants = filteredByStatusParticipants.filter(
      participant => !participantViewEventId || participant.event_id === participantViewEventId
    )

    const searchedParticipants = visibleParticipants.filter(participant => {
      if (!normalizedParticipantSearch) return true

      const eventTitle = eventTitleById.get(participant.event_id) || ''
      const searchableText = [
        participant.exhibitor_name,
        participant.email,
        participant.booth,
        eventTitle
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedParticipantSearch)
    })

    const sortedParticipants = searchedParticipants.slice()

    sortedParticipants.sort((left, right) => {
      if (sortOrder === 'name-asc') {
        return String(left.exhibitor_name || '').localeCompare(String(right.exhibitor_name || ''), 'de', {
          sensitivity: 'base'
        })
      }

      if (sortOrder === 'event-asc') {
        return String(eventTitleById.get(left.event_id) || '').localeCompare(
          String(eventTitleById.get(right.event_id) || ''),
          'de',
          { sensitivity: 'base' }
        )
      }

      if (sortOrder === 'payment-open-first') {
        if (left.paid !== right.paid) return left.paid ? 1 : -1
        return String(left.exhibitor_name || '').localeCompare(String(right.exhibitor_name || ''), 'de', {
          sensitivity: 'base'
        })
      }

      const leftStatus = getEffectiveParticipantStatus(left)
      const rightStatus = getEffectiveParticipantStatus(right)
      const leftPriority = PARTICIPANT_SORT_PRIORITY[leftStatus] ?? 99
      const rightPriority = PARTICIPANT_SORT_PRIORITY[rightStatus] ?? 99

      if (leftPriority !== rightPriority) return leftPriority - rightPriority

      return String(left.exhibitor_name || '').localeCompare(String(right.exhibitor_name || ''), 'de', {
        sensitivity: 'base'
      })
    })

    return sortedParticipants
  }, [
    eventTitleById,
    filteredByStatusParticipants,
    normalizedParticipantSearch,
    participantViewEventId,
    sortOrder
  ])

  const hasActiveParticipantControls =
    normalizedParticipantSearch.length > 0 ||
    participantViewFilter !== 'alle' ||
    Boolean(participantViewEventId) ||
    sortOrder !== 'status-open-first'
  const resultCountText =
    filteredParticipants.length === 0
      ? 'Keine Teilnehmer gefunden'
      : hasActiveParticipantControls
        ? `${filteredParticipants.length} Teilnehmer gefunden`
        : `${filteredParticipants.length} Teilnehmer`

  useEffect(() => {
    if (!participantViewEventId) return

    setForm(current =>
      current.event_id === participantViewEventId
        ? current
        : { ...current, event_id: participantViewEventId }
    )
  }, [participantViewEventId])

  function resetParticipantListControls() {
    setParticipantSearch('')
    setParticipantViewFilter?.('alle')
    setParticipantViewEventId?.('')
    setSortOrder('status-open-first')
  }

  async function addParticipant(event) {
    event.preventDefault()

    try {
      const payload = {
        ...form,
        event_id: form.event_id || null,
        email: form.email || null,
        booth: form.booth || null
      }

      const { error } = await supabase.from('event_participants').insert(payload)
      if (error) throw error

      setForm({
        event_id: '',
        exhibitor_name: '',
        email: '',
        booth: '',
        paid: false,
        status: 'angefragt'
      })
      await reload()
      notify?.('success', 'Teilnehmer gespeichert.')
    } catch (err) {
      notify?.('error', `Teilnehmer konnte nicht gespeichert werden: ${getParticipantStatusErrorMessage(err)}`)
    }
  }

  return (
    <div className="grid two" data-testid="participants-page">
      {roleView !== 'exhibitor' && (
        <div className="card">
          <h2>Teilnehmer hinzufügen</h2>
          <form onSubmit={addParticipant} className="grid">
            <select
              required
              value={form.event_id}
              onChange={event => setForm({ ...form, event_id: event.target.value })}
            >
              <option value="">Event wählen</option>
              {sourceEvents.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <input
              className="input"
              required
              placeholder="Ausstellername"
              value={form.exhibitor_name}
              onChange={event => setForm({ ...form, exhibitor_name: event.target.value })}
            />
            <input
              className="input"
              type="email"
              placeholder="E-Mail"
              value={form.email}
              onChange={event => setForm({ ...form, email: event.target.value })}
            />
            <input
              className="input"
              placeholder="Standplatz"
              value={form.booth}
              onChange={event => setForm({ ...form, booth: event.target.value })}
            />
            <select
              value={form.status}
              onChange={event => setForm({ ...form, status: event.target.value })}
            >
              {participantStatusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="row">
              <input
                type="checkbox"
                checked={form.paid}
                onChange={event => setForm({ ...form, paid: event.target.checked })}
              />{' '}
              Bezahlt
            </label>
            <button className="btn">Speichern</button>
          </form>
        </div>
      )}

      <div className="card participant-overview-card">
        <div className="list-toolbar" data-testid="participants-toolbar">
          <div className="list-toolbar-row">
            <div>
              <h2>{roleView === 'exhibitor' ? 'Meine Teilnahmen' : 'Teilnehmer'}</h2>
              <p className="list-result-count" data-testid="participants-result-count">
                {resultCountText}
              </p>
            </div>
            {hasActiveParticipantControls && (
              <button
                className="btn ghost"
                data-testid="participants-reset-filters"
                onClick={resetParticipantListControls}
                type="button"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>

          <div className="list-toolbar-row list-toolbar-controls">
            <div className="field-group list-search">
              <label htmlFor="participants-search">Suche</label>
              <input
                id="participants-search"
                className="input"
                data-testid="participants-search"
                placeholder="Nach Teilnehmername, E-Mail oder Stand suchen"
                value={participantSearch}
                onChange={event => setParticipantSearch(event.target.value)}
              />
            </div>

            <div className="list-filter-group">
              <div className="field-group">
                <label htmlFor="participants-page-event-filter">Event filtern</label>
                <select
                  id="participants-page-event-filter"
                  data-testid="participants-page-event-filter"
                  value={participantViewEventId}
                  onChange={event => setParticipantViewEventId?.(event.target.value)}
                >
                  <option value="">Alle Events</option>
                  {sourceEvents.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.title || 'Ohne Eventname'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="participants-sort-order">Sortierung</label>
                <select
                  id="participants-sort-order"
                  data-testid="participants-sort-order"
                  value={sortOrder}
                  onChange={event => setSortOrder(event.target.value)}
                >
                  <option value="status-open-first">Status: offene zuerst</option>
                  <option value="payment-open-first">Zahlung offen zuerst</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="event-asc">Event A–Z</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <p className="muted participant-filter-help">
          Nutze Filter und Eventauswahl, um offene Prüfungen, Wartelisten und offene Zahlungen
          schneller zu prüfen.
        </p>
        <div className="participant-filter-summary compact" data-testid="participants-page-filters">
          {participantFilterOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              data-testid={`participants-page-filter-${value}`}
              className={`participant-filter-chip ${participantViewFilter === value ? 'active' : ''}`}
              onClick={() => setParticipantViewFilter?.(value)}
            >
              <span>{label}</span>
              <strong>{participantSummaryForEvent[value]}</strong>
            </button>
          ))}
        </div>

        <div className="list">
          {sourceParticipants.length === 0 ? (
            <div className="list-empty-state" data-testid="participants-page-empty">
              <strong>Noch keine Teilnehmer angelegt.</strong>
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="list-empty-state" data-testid="participants-page-empty">
              <strong>Keine Teilnehmer gefunden.</strong>
              <p className="muted">Ändere die Suche oder setze die Filter zurück.</p>
              {hasActiveParticipantControls && (
                <button
                  className="btn ghost"
                  data-testid="participants-empty-reset"
                  onClick={resetParticipantListControls}
                  type="button"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          ) : (
            filteredParticipants.map(participant => (
              <div className="item" data-testid="participants-page-item" key={participant.id}>
                <div className="participant-row">
                  <div>
                    <strong>{participant.exhibitor_name}</strong>
                    <p className="muted">
                      {participant.email || 'Keine E-Mail'} · Stand {participant.booth || '-'} ·{' '}
                      {eventTitleById.get(participant.event_id) || 'Ohne Event'}
                    </p>
                  </div>
                  <div className="participant-badges">
                    <span className={getParticipantStatusClass(participant.status)}>
                      {getParticipantStatusLabel(participant.status)}
                    </span>
                    <span className={participant.paid ? 'pill status-payment-paid' : 'pill status-payment-open'}>
                      {participant.paid ? 'Bezahlt' : 'Offen'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
