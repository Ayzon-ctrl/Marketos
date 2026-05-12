import { CalendarDays, Globe, MapPin, Trash2 } from 'lucide-react'
import { fmtDate, getEventVisibilityLabel } from '../lib/eventUtils'

export default function EventCard({
  event,
  issue,
  onDelete,
  onEdit,
  onOpen,
  onTogglePublish
}) {
  const isPublic = Boolean(event.public_visible)

  return (
    <article className={`event-card ${issue ? 'has-issue' : ''}`} data-testid="event-card">
      <div className="event-card-header">
        <h3 data-testid="event-card-title">{event.title || 'Ohne Eventname'}</h3>
        <div className="row compact-wrap">
          <span
            className={`pill ${isPublic ? 'status-visibility-public' : 'status-visibility-internal'}`}
            data-testid="event-visibility-badge"
          >
            <Globe size={14} /> {getEventVisibilityLabel(event)}
          </span>
          {issue && <span className="pill status-quality-review">Prüfung nötig</span>}
        </div>
      </div>
      <p>
        <CalendarDays size={16} /> {fmtDate(event.event_date)}
      </p>
      <p>
        <MapPin size={16} /> {event.location || 'Stadt fehlt'}
      </p>
      {issue && <p className="field-error">{issue.problems.join(' · ')}</p>}
      <div className="event-card-actions">
        {onOpen && (
          <button className="btn secondary" data-testid="open-event-detail" onClick={() => onOpen(event)} type="button">
            <CalendarDays size={16} /> Öffnen
          </button>
        )}
        {!isPublic && onTogglePublish && (
          <button
            className="btn"
            data-testid="publish-event"
            onClick={() => onTogglePublish(event, true)}
            type="button"
          >
            <Globe size={16} /> Veröffentlichen
          </button>
        )}
        {isPublic && onTogglePublish && (
          <button
            className="btn ghost"
            data-testid="unpublish-event"
            onClick={() => onTogglePublish(event, false)}
            type="button"
          >
            Sichtbarkeit beenden
          </button>
        )}
        {onEdit && (
          <button className="btn ghost" data-testid="edit-event" onClick={() => onEdit(event)} type="button">
            {issue ? 'Stadt zuweisen' : 'Bearbeiten'}
          </button>
        )}
        {onDelete && (
          <button className="btn danger-outline" data-testid="delete-event" onClick={() => onDelete(event)} type="button">
            <Trash2 size={16} /> Löschen
          </button>
        )}
      </div>
    </article>
  )
}
