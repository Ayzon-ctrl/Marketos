import { useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { sanitizeExternalUrl } from '../../lib/urlSafety'
import { getUserErrorMessage } from '../../lib/userError'

const CONTRACT_STATUS_LABELS = {
  uploaded: 'Hochgeladen',
  review: 'In Prüfung',
  signed: 'Unterzeichnet',
  archived: 'Archiviert'
}

const CONTRACT_STATUS_CLASSNAMES = {
  uploaded: 'pill info-pill',
  review: 'pill status-quality-review',
  signed: 'pill ok',
  archived: 'pill status-visibility-internal'
}

const CONTRACT_STATUS_ORDER = {
  uploaded: 0,
  review: 1,
  signed: 2,
  archived: 3
}

function looksLikeExternalUrl(value) {
  const rawValue = String(value || '').trim()
  return /^(https?:\/\/|javascript:|data:|ftp:\/\/|mailto:|blob:)/i.test(rawValue)
}

function getContractStatusLabel(status) {
  return CONTRACT_STATUS_LABELS[status] || status || 'Unbekannt'
}

function getContractStatusClassName(status) {
  return CONTRACT_STATUS_CLASSNAMES[status] || 'pill'
}

function getResultCountText(count, hasActiveControls) {
  if (count === 0) return 'Keine Dokumente gefunden'

  const baseLabel = `${count} Dokument${count === 1 ? '' : 'e'}`
  return hasActiveControls ? `${baseLabel} gefunden` : baseLabel
}

export default function ContractsView({ contracts, events, profile, reload, notify, openEventDetail }) {
  const [form, setForm] = useState({ title: '', event_id: '', file_path: '' })
  const [referenceError, setReferenceError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')

  const eventById = useMemo(() => new Map((events || []).map(event => [event.id, event])), [events])
  const normalizedSearch = search.trim().toLowerCase()

  const contractsWithMeta = useMemo(
    () =>
      (contracts || []).map((contract, index) => ({
        ...contract,
        originalIndex: index,
        linkedEvent: eventById.get(contract.event_id) || null,
        eventTitle: eventById.get(contract.event_id)?.title || 'Ohne Event',
        safeReferenceUrl: sanitizeExternalUrl(contract.file_path),
        statusLabel: getContractStatusLabel(contract.status)
      })),
    [contracts, eventById]
  )

  const filteredContracts = useMemo(() => {
    const visibleContracts = contractsWithMeta.filter(contract => {
      const matchesStatus = statusFilter === 'all' ? true : contract.status === statusFilter
      if (!matchesStatus) return false

      const matchesEvent =
        eventFilter === 'all'
          ? true
          : eventFilter === 'without-event'
            ? !contract.event_id
            : contract.event_id === eventFilter
      if (!matchesEvent) return false

      if (!normalizedSearch) return true

      const searchableText = [contract.title, contract.file_path, contract.eventTitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedSearch)
    })

    const sortedContracts = visibleContracts.slice()
    sortedContracts.sort((left, right) => {
      if (sortOrder === 'title-asc') {
        return String(left.title || '').localeCompare(String(right.title || ''), 'de', {
          sensitivity: 'base'
        })
      }

      if (sortOrder === 'event-asc') {
        return String(left.eventTitle || '').localeCompare(String(right.eventTitle || ''), 'de', {
          sensitivity: 'base'
        })
      }

      if (sortOrder === 'status') {
        const leftStatus = CONTRACT_STATUS_ORDER[left.status] ?? 99
        const rightStatus = CONTRACT_STATUS_ORDER[right.status] ?? 99
        if (leftStatus !== rightStatus) return leftStatus - rightStatus

        return String(left.title || '').localeCompare(String(right.title || ''), 'de', {
          sensitivity: 'base'
        })
      }

      if (left.created_at && right.created_at) {
        return String(right.created_at).localeCompare(String(left.created_at))
      }

      return left.originalIndex - right.originalIndex
    })

    return sortedContracts
  }, [contractsWithMeta, eventFilter, normalizedSearch, sortOrder, statusFilter])

  const hasActiveControls =
    normalizedSearch.length > 0 ||
    statusFilter !== 'all' ||
    eventFilter !== 'all' ||
    sortOrder !== 'newest'
  const resultCountText = getResultCountText(filteredContracts.length, hasActiveControls)
  const noResultsTitle =
    eventFilter !== 'all' ? 'Keine Dokumente für dieses Event gefunden.' : 'Keine Dokumente gefunden.'
  const noResultsHint =
    eventFilter !== 'all'
      ? 'Wähle ein anderes Event oder setze die Filter zurück.'
      : 'Ändere die Suche oder setze die Filter zurück.'

  function resetControls() {
    setSearch('')
    setStatusFilter('all')
    setEventFilter('all')
    setSortOrder('newest')
  }

  async function addContract(event) {
    event.preventDefault()

    try {
      const normalizedReference = String(form.file_path || '').trim()
      const safeReferenceUrl = sanitizeExternalUrl(normalizedReference)

      if (normalizedReference && looksLikeExternalUrl(normalizedReference) && !safeReferenceUrl) {
        const nextMessage =
          'Bitte nutze einen vollständigen http- oder https-Link oder eine normale Textreferenz.'
        setReferenceError(nextMessage)
        notify?.('error', nextMessage)
        return
      }

      const { error } = await supabase.from('contracts').insert({
        ...form,
        file_path: normalizedReference ? safeReferenceUrl || normalizedReference : '',
        event_id: form.event_id || null,
        owner_id: profile.id,
        status: 'uploaded'
      })
      if (error) throw error

      setForm({ title: '', event_id: '', file_path: '' })
      setReferenceError('')
      await reload()
      notify?.('success', 'Dokument abgelegt.')
    } catch (err) {
      notify?.('error', getUserErrorMessage(err, 'Dokument konnte nicht gespeichert werden.'))
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <h2>Dokument anlegen</h2>
        <p className="muted">
          V1 speichert Metadaten. Lege eine Referenz an, um Verträge oder Unterlagen einem Event
          zuzuordnen.
        </p>
        <form onSubmit={addContract} className="grid">
          <input
            className="input"
            required
            placeholder="Titel"
            value={form.title}
            onChange={event => setForm({ ...form, title: event.target.value })}
          />
          <select
            value={form.event_id}
            onChange={event => setForm({ ...form, event_id: event.target.value })}
          >
            <option value="">Ohne Event</option>
            {events.map(eventItem => (
              <option key={eventItem.id} value={eventItem.id}>
                {eventItem.title}
              </option>
            ))}
          </select>

          <div className="field-group">
            <label htmlFor="contract-reference-input">Referenz / Ablageort</label>
            <input
              id="contract-reference-input"
              className={`input ${referenceError ? 'input-error' : ''}`}
              data-testid="contract-reference-input"
              placeholder="z. B. Google-Drive-Link, interner Ablageort oder Vertragsnummer"
              value={form.file_path}
              onChange={event => {
                setReferenceError('')
                setForm({ ...form, file_path: event.target.value })
              }}
            />
            <p className="field-hint">
              Optional: interner Ablagehinweis oder sicherer HTTPS-Link. Kein Datei-Upload.
            </p>
            {referenceError && <p className="field-error">{referenceError}</p>}
          </div>

          <button className="btn">Ablegen</button>
        </form>
      </div>

      <div className="card">
        <div className="list-toolbar" data-testid="contracts-toolbar">
          <div className="list-toolbar-row">
            <div>
              <h2>Dokumente</h2>
              <p className="list-result-count" data-testid="contracts-result-count">
                {resultCountText}
              </p>
            </div>
            {hasActiveControls && (
              <button
                className="btn ghost"
                data-testid="contracts-reset-filters"
                onClick={resetControls}
                type="button"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>

          <div className="list-toolbar-row list-toolbar-controls">
            <div className="field-group list-search">
              <label htmlFor="contracts-search">Suche</label>
              <input
                id="contracts-search"
                className="input"
                data-testid="contracts-search"
                placeholder="Nach Titel, Event oder Referenz suchen"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>

            <div className="list-filter-group">
              <div className="field-group">
                <label htmlFor="contracts-event-filter">Event</label>
                <select
                  id="contracts-event-filter"
                  data-testid="contracts-event-filter"
                  value={eventFilter}
                  onChange={event => setEventFilter(event.target.value)}
                >
                  <option value="all">Alle Events</option>
                  <option value="without-event">Ohne Event</option>
                  {events.map(eventItem => (
                    <option key={eventItem.id} value={eventItem.id}>
                      {eventItem.title || 'Ohne Eventname'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="contracts-status-filter">Status</label>
                <select
                  id="contracts-status-filter"
                  data-testid="contracts-status-filter"
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                >
                  <option value="all">Alle</option>
                  <option value="uploaded">Hochgeladen</option>
                  <option value="review">In Prüfung</option>
                  <option value="signed">Unterzeichnet</option>
                  <option value="archived">Archiviert</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="contracts-sort-order">Sortierung</label>
                <select
                  id="contracts-sort-order"
                  data-testid="contracts-sort-order"
                  value={sortOrder}
                  onChange={event => setSortOrder(event.target.value)}
                >
                  <option value="newest">Neueste zuerst</option>
                  <option value="title-asc">Titel A–Z</option>
                  <option value="event-asc">Event A–Z</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="list">
          {contracts.length === 0 ? (
            <div className="list-empty-state" data-testid="contracts-empty-state">
              <strong>Noch keine Dokumente angelegt.</strong>
              <p className="muted">
                Lege eine Referenz an, um Verträge oder Unterlagen einem Event zuzuordnen.
              </p>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="list-empty-state" data-testid="contracts-no-results">
              <strong>{noResultsTitle}</strong>
              <p className="muted">{noResultsHint}</p>
              {hasActiveControls && (
                <button
                  className="btn ghost"
                  data-testid="contracts-empty-reset"
                  onClick={resetControls}
                  type="button"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          ) : (
            filteredContracts.map(contract => (
              <div className="item" data-testid="contract-item" key={contract.id}>
                <div className="row space-between">
                  <strong>{contract.title}</strong>
                  <span className={getContractStatusClassName(contract.status)}>
                    {contract.statusLabel}
                  </span>
                </div>
                <p className="muted">Event: {contract.eventTitle}</p>
                {contract.file_path ? (
                  <p className="muted">
                    Referenz:{' '}
                    {contract.safeReferenceUrl ? (
                      <a href={contract.safeReferenceUrl} rel="noopener noreferrer" target="_blank">
                        {contract.file_path}
                      </a>
                    ) : (
                      <span>{contract.file_path}</span>
                    )}
                  </p>
                ) : (
                  <p className="muted">Referenz: Keine Referenz hinterlegt</p>
                )}
                {contract.linkedEvent && openEventDetail ? (
                  <button
                    className="btn ghost"
                    data-testid="contract-open-event"
                    onClick={() => openEventDetail(contract.linkedEvent)}
                    type="button"
                  >
                    Event öffnen
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
