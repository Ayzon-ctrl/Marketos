import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import {
  getParticipantStatusClass,
  getParticipantStatusLabel,
  participantFilterOptions,
  participantStatusOptions
} from '../../lib/participantUtils'

export default function EventParticipantsSection({
  participantFilter,
  setParticipantFilter,
  participantSummary,
  participantForm,
  setParticipantForm,
  editingParticipantId,
  busyParticipant,
  resetParticipantForm,
  addParticipant,
  filteredEventParticipants,
  updateParticipantStatus,
  toggleParticipantPaid,
  editParticipant,
  setParticipantToDelete,
  openParticipantsView,
  selectedEvent,
  linkableVendors = []
}) {
  const [participantsExpanded, setParticipantsExpanded] = useState(false)

  return (
    <section className="event-detail-participants-stack" data-testid="event-detail-participants">
      <div className="card detail-column event-detail-participants-card">
        <div className="row space-between">
          <h3>Teilnehmer hinzufügen</h3>
          <button
            className="btn ghost"
            data-testid="detail-open-participants-view"
            type="button"
            onClick={() => openParticipantsView?.(participantFilter, selectedEvent.id)}
          >
            Teilnehmerseite öffnen
          </button>
        </div>
        <p className="muted participant-filter-help">
          Teilnehmer und Stände schnell erfassen. Die vollständige Liste bleibt darunter bei Bedarf
          aufklappbar.
        </p>

        <div className="participant-filter-summary" data-testid="participant-filter-summary">
          {participantFilterOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              data-testid={`participant-filter-${value}`}
              className={`participant-filter-chip ${participantFilter === value ? 'active' : ''}`}
              onClick={() => setParticipantFilter(value)}
            >
              <span>{label}</span>
              <strong>{participantSummary[value]}</strong>
            </button>
          ))}
        </div>

        <form className="detail-form" onSubmit={addParticipant}>
          <select
            className="input"
            data-testid="detail-participant-linked-vendor"
            value={participantForm.linked_vendor_profile_id}
            onChange={event => {
              const selectedVendor = linkableVendors.find(vendor => vendor.id === event.target.value)
              setParticipantForm({
                ...participantForm,
                linked_vendor_profile_id: event.target.value,
                exhibitor_name:
                  selectedVendor && !participantForm.exhibitor_name.trim()
                    ? selectedVendor.business_name
                    : participantForm.exhibitor_name
              })
            }}
          >
            <option value="">Ohne Profil-Verknüpfung</option>
            {linkableVendors.map(vendor => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.business_name}
                {vendor.category ? ` · ${vendor.category}` : ''}
              </option>
            ))}
          </select>
          <input
            className="input"
            data-testid="detail-participant-name"
            placeholder="Ausstellername"
            value={participantForm.exhibitor_name}
            onChange={event =>
              setParticipantForm({ ...participantForm, exhibitor_name: event.target.value })
            }
          />
          <input
            className="input"
            data-testid="detail-participant-email"
            type="email"
            placeholder="E-Mail"
            value={participantForm.email}
            onChange={event => setParticipantForm({ ...participantForm, email: event.target.value })}
          />
          <input
            className="input"
            data-testid="detail-participant-booth"
            placeholder="Standplatz"
            value={participantForm.booth}
            onChange={event => setParticipantForm({ ...participantForm, booth: event.target.value })}
          />
          <select
            className="input"
            data-testid="detail-participant-status"
            value={participantForm.status}
            onChange={event => setParticipantForm({ ...participantForm, status: event.target.value })}
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
              checked={participantForm.paid}
              onChange={event => setParticipantForm({ ...participantForm, paid: event.target.checked })}
            />{' '}
            Bezahlt
          </label>
          <div className="event-issue-actions">
            <button className="btn" data-testid="detail-save-participant" disabled={busyParticipant}>
              {busyParticipant
                ? 'Speichert...'
                : editingParticipantId
                  ? 'Teilnehmer speichern'
                  : 'Teilnehmer hinzufügen'}
            </button>
            {editingParticipantId && (
              <button
                className="btn ghost"
                data-testid="detail-cancel-participant-edit"
                type="button"
                onClick={resetParticipantForm}
              >
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card detail-column event-detail-participant-list-card">
        <div className="row space-between">
          <div>
            <h3>Teilnehmerliste</h3>
            <p className="muted small" data-testid="event-detail-participants-collapsed-summary">
              {participantSummary.alle} Teilnehmer · {participantSummary.angefragt} In Prüfung ·{' '}
              {participantSummary.bestaetigt} Bestätigt · {participantSummary.warteliste} Warteliste ·{' '}
              {participantSummary.abgesagt} Abgesagt · {participantSummary.offen} Offen ·{' '}
              {participantSummary.bezahlt} Bezahlt
            </p>
          </div>
          <button
            className="btn ghost"
            data-testid="event-detail-participants-toggle"
            onClick={() => setParticipantsExpanded(current => !current)}
            type="button"
          >
            {participantsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {participantsExpanded ? 'Liste ausblenden' : 'Liste anzeigen'}
          </button>
        </div>

        {participantsExpanded ? (
          <div className="detail-list participant-detail-grid" data-testid="event-detail-participants-list">
            {filteredEventParticipants.length === 0 && (
              <div className="participant-empty-state" data-testid="detail-participant-empty">
                <strong>
                  {participantFilter === 'alle'
                    ? 'Für dieses Event gibt es noch keine Teilnehmer.'
                    : `Für den Filter "${
                        participantFilterOptions.find(([value]) => value === participantFilter)?.[1] ||
                        participantFilter
                      }" gibt es aktuell keine Teilnehmer.`}
                </strong>
                <p className="muted">
                  {participantFilter === 'alle'
                    ? 'Füge einen Teilnehmer hinzu oder verknüpfe ein bestehendes Profil.'
                    : 'Ändere den Filter oder füge einen Teilnehmer hinzu.'}
                </p>
              </div>
            )}
            {filteredEventParticipants.map(participant => (
              <div className="item participant-detail-item" data-testid="detail-participant-item" key={participant.id}>
                <div className="participant-row">
                  <div>
                    <strong>{participant.exhibitor_name || 'Ohne Namen'}</strong>
                    <p className="muted">
                      {participant.email || 'Keine E-Mail'} · Stand {participant.booth || '-'}
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
                <div className="participant-actions">
                  <div className="participant-actions-main">
                    <select
                      className="input participant-status-select"
                      data-testid="detail-participant-status-select"
                      value={participant.status || 'angefragt'}
                      onChange={event => updateParticipantStatus(participant, event.target.value)}
                    >
                      {participantStatusOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="participant-actions-secondary">
                    <button
                      className="btn secondary"
                      data-testid="detail-toggle-paid"
                      type="button"
                      onClick={() => toggleParticipantPaid(participant)}
                    >
                      {participant.paid ? 'Als offen markieren' : 'Als bezahlt markieren'}
                    </button>
                    <button
                      className="btn ghost"
                      data-testid="detail-edit-participant"
                      type="button"
                      onClick={() => editParticipant(participant)}
                    >
                      Bearbeiten
                    </button>
                  </div>
                  <div className="participant-actions-danger">
                    <button
                      className="btn danger-outline"
                      data-testid="detail-delete-participant"
                      type="button"
                      onClick={() => setParticipantToDelete(participant)}
                    >
                      <Trash2 size={16} /> Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
