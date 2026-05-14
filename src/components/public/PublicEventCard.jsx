import { CalendarDays, MapPin, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fmtDateRange, fmtOpeningHours } from '../../lib/eventUtils'

function boolLabel(value, label) {
  return `${label}: ${value ? 'Ja' : 'Nein'}`
}

function promotionLabel(type) {
  if (type === 'featured') return 'Empfohlen'
  if (type === 'sponsored') return 'Sponsored'
  if (type === 'highlight') return 'Hervorgehoben'
  return ''
}

export default function PublicEventCard({ event }) {
  return (
    <article className="public-card public-event-card" data-testid="public-market-card">
      <div className="public-card-topline">
        <span className="pill ok">{fmtDateRange(event.event_date, event.end_date)}</span>
        <span className="pill">{fmtOpeningHours(event.opening_time, event.closing_time)}</span>
        {event.promotion_type && <span className="pill warn">{promotionLabel(event.promotion_type)}</span>}
      </div>
      <h3>{event.title || 'Ohne Eventname'}</h3>
      <p className="public-meta-line">
        <CalendarDays size={16} /> {fmtDateRange(event.event_date, event.end_date)}
      </p>
      <p className="public-meta-line">
        <MapPin size={16} /> {event.location || 'Ort folgt'}
      </p>
      <p className="public-meta-line">
        <Store size={16} /> {event.vendor_count || 0} Händler
      </p>
      <div className="public-facts">
        <span className="pill">{event.is_indoor ? 'Indoor' : 'Nicht indoor'}</span>
        <span className="pill">{event.is_outdoor ? 'Outdoor' : 'Nicht outdoor'}</span>
        <span className="pill">{boolLabel(event.is_covered, 'Überdacht')}</span>
        <span className="pill">{boolLabel(event.is_accessible, 'Barrierefrei')}</span>
      </div>
      <Link className="btn" to={`/markets/${event.id}`}>
        Details ansehen
      </Link>
    </article>
  )
}
