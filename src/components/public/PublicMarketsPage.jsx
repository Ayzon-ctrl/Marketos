import { useEffect, useMemo, useState } from 'react'
import PublicEventCard from './PublicEventCard'
import { loadPublicMarkets } from '../../lib/publicData'
import { getUserErrorMessage } from '../../lib/userError'

export default function PublicMarketsPage() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    events: []
  })

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const events = await loadPublicMarkets()
        if (!active) return
        setState({ loading: false, error: '', events })
      } catch (error) {
        if (!active) return
        setState({ loading: false, error: getUserErrorMessage(error, 'Märkte konnten nicht geladen werden.'), events: [] })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const promotedEvents = useMemo(() => state.events.filter(event => Boolean(event.promotion_type)), [state.events])
  const regularEvents = useMemo(() => state.events.filter(event => !event.promotion_type), [state.events])

  return (
    <div className="public-page" data-testid="public-markets-page">
      <section className="public-section-heading heroish">
        <div>
          <h1>Märkte & Events</h1>
          <p className="muted">
            Öffentliche Events, sortiert nach Datum. Vergangene Termine bleiben aus der Hauptliste
            raus, damit Besucher direkt das Nächste sehen.
          </p>
        </div>
      </section>

      {state.error && (
        <div className="card public-state-card" data-testid="public-page-error">
          <strong>Öffentliche Märkte brauchen noch Setup</strong>
          <p>{state.error}</p>
        </div>
      )}

      {promotedEvents.length > 0 && (
        <section className="public-section" data-testid="promoted-events-list">
          <div className="public-section-heading">
            <div>
              <h2>Hervorgehobene Märkte</h2>
              <p className="muted">Aktive Hervorhebungen erscheinen hier automatisch vor der Hauptliste.</p>
            </div>
          </div>
          <div className="public-card-grid">
            {promotedEvents.map(event => (
              <PublicEventCard key={`promoted-${event.id}`} event={event} />
            ))}
          </div>
        </section>
      )}

      <section className="public-card-grid">
        {!state.loading && promotedEvents.length === 0 && regularEvents.length === 0 && !state.error && (
          <div className="card public-state-card" data-testid="public-page-empty">
            Noch keine öffentlichen Märkte sichtbar.
          </div>
        )}
        {regularEvents.map(event => (
          <PublicEventCard key={event.id} event={event} />
        ))}
      </section>
    </div>
  )
}
