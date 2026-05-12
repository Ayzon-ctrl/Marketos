import { Link } from 'react-router-dom'
import { fmtDate } from '../../lib/eventUtils'

export default function VisitorOverviewView({
  favoriteEvents = [],
  favoriteVendors = [],
  notifications = [],
  profileName,
  stats = []
}) {
  const unreadNotifications = notifications.filter(item => !item.read_at).slice(0, 4)

  return (
    <div className="grid" data-testid="visitor-overview-view">
      <div className="card visitor-welcome-card">
        <h2>Hallo {profileName}</h2>
        <p className="muted">
          Deine Merkliste sammelt Märkte und Händler, die du später schnell wiederfinden willst.
        </p>
        <div className="grid stats">
          {stats.map(stat => (
            <div className="card stat-card compact" key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid two">
        <div className="card" data-testid="visitor-favorite-events">
          <div className="row space-between">
            <div>
              <h2>Gespeicherte Märkte</h2>
              <p className="muted">Deine nächsten Marktbesuche auf einen Blick.</p>
            </div>
            <Link className="btn ghost" to="/markets">
              Mehr Märkte
            </Link>
          </div>
          <div className="list">
            {favoriteEvents.length === 0 && (
              <div className="item">
                <strong>Noch kein Markt gespeichert.</strong>
                <p className="muted">Öffne einen Markt und speichere ihn mit einem Klick.</p>
              </div>
            )}
            {favoriteEvents.map(event => (
              <Link className="item public-linked-item" key={event.id} to={`/markets/${event.id}`}>
                <strong>{event.title || 'Ohne Eventname'}</strong>
                <p className="muted">{fmtDate(event.event_date)} · {event.location || 'Ort folgt'}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="card" data-testid="visitor-favorite-vendors">
          <div className="row space-between">
            <div>
              <h2>Gespeicherte Händler</h2>
              <p className="muted">Marken und Stände, die du wiederfinden möchtest.</p>
            </div>
            <Link className="btn ghost" to="/vendors">
              Mehr Händler
            </Link>
          </div>
          <div className="list">
            {favoriteVendors.length === 0 && (
              <div className="item">
                <strong>Noch kein Händler gespeichert.</strong>
                <p className="muted">Öffne ein Händlerprofil und speichere es für später.</p>
              </div>
            )}
            {favoriteVendors.map(vendor => (
              <Link className="item public-linked-item" key={vendor.id} to={`/vendors/${vendor.id}`}>
                <strong>{vendor.business_name}</strong>
                <p className="muted">{vendor.category || 'Händlerprofil'}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card" data-testid="visitor-latest-updates">
        <div className="row space-between">
          <div>
            <h2>Neu aus deiner Merkliste</h2>
            <p className="muted">So bleiben Besucher ohne Push oder E-Mail trotzdem nah dran.</p>
          </div>
          <Link className="btn ghost" to="/app/updates">
            Alle Updates
          </Link>
        </div>
        <div className="list">
          {unreadNotifications.length === 0 && (
            <div className="item">
              <strong>Aktuell keine neuen Hinweise.</strong>
              <p className="muted">Sobald ein favorisierter Markt oder Händler etwas postet, siehst du es hier.</p>
            </div>
          )}
          {unreadNotifications.map(notification => (
            <div className="item" key={notification.id}>
              <strong>{notification.title}</strong>
              <p className="muted">{notification.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
