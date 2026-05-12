import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Store, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicEventCard from './PublicEventCard'
import PublicVendorCard from './PublicVendorCard'
import { loadPublicLandingData } from '../../lib/publicData'
import { getUserErrorMessage } from '../../lib/userError'

export default function PublicLandingPage() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    events: [],
    vendors: [],
    promotedEvents: [],
    promotedVendors: []
  })

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await loadPublicLandingData()
        if (!active) return
        setState({
          loading: false,
          error: '',
          events: data.events,
          vendors: data.vendors,
          promotedEvents: data.promotedEvents || [],
          promotedVendors: data.promotedVendors || []
        })
      } catch (error) {
        if (!active) return
        setState({
          loading: false,
          error: getUserErrorMessage(error, 'Startseite konnte nicht geladen werden.'),
          events: [],
          vendors: [],
          promotedEvents: [],
          promotedVendors: []
        })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="public-page" data-testid="public-home-page">
      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="pill ok">Public-first Plattform</span>
          <h1>Entdecke Märkte, Events und kleine Händler in deiner Nähe.</h1>
          <p>
            MarketOS macht Märkte sichtbar: Besucher sehen kommende Events, entdecken Händler und finden
            schnell die wichtigsten Infos. Der Login führt nur in den geschützten Verwaltungsbereich.
          </p>
          <div className="public-hero-actions">
            <Link className="btn" to="/markets" data-testid="public-hero-cta">
              Nächste Märkte ansehen <ArrowRight size={16} />
            </Link>
            <Link className="btn secondary" to="/vendors">
              Händler entdecken
            </Link>
          </div>
        </div>

        <div className="public-hero-aside">
          <div className="public-highlight-card">
            <CalendarDays size={18} />
            <div>
              <strong>Kommende Märkte</strong>
              <p>{state.loading ? 'Lädt...' : `${state.events.length} sichtbare Events in der Vorschau`}</p>
            </div>
          </div>
          <div className="public-highlight-card">
            <Store size={18} />
            <div>
              <strong>Öffentliche Händler</strong>
              <p>{state.loading ? 'Lädt...' : `${state.vendors.length} ausgewählte Händler im Fokus`}</p>
            </div>
          </div>
          <div className="public-highlight-card">
            <Users size={18} />
            <div>
              <strong>Für Besucher einfach</strong>
              <p>Kein Login nötig, nur klare Infos und direkte Wege zu Märkten und Händlern.</p>
            </div>
          </div>
        </div>
      </section>

      {state.error && (
        <div className="card public-state-card" data-testid="public-page-error">
          <strong>Öffentliche Plattform braucht noch Setup</strong>
          <p>{state.error}</p>
        </div>
      )}

      {state.promotedEvents.length > 0 && (
        <section className="public-section" data-testid="promoted-events-section">
          <div className="public-section-heading">
            <div>
              <h2>Hervorgehobene Märkte</h2>
              <p className="muted">Dieser Bereich erscheint nur, wenn aktive Hervorhebungen vorhanden sind.</p>
            </div>
          </div>
          <div className="public-card-grid">
            {state.promotedEvents.map(event => (
              <PublicEventCard key={`promoted-${event.id}`} event={event} />
            ))}
          </div>
        </section>
      )}

      {state.promotedVendors.length > 0 && (
        <section className="public-section" data-testid="promoted-vendors-section">
          <div className="public-section-heading">
            <div>
              <h2>Empfohlene Händler</h2>
              <p className="muted">Auch dieser Bereich bleibt unsichtbar, solange keine Hervorhebungen aktiv sind.</p>
            </div>
          </div>
          <div className="public-card-grid vendors">
            {state.promotedVendors.map(vendor => (
              <PublicVendorCard key={`promoted-${vendor.id}`} vendor={vendor} />
            ))}
          </div>
        </section>
      )}

      <section className="public-section">
        <div className="public-section-heading">
          <div>
            <h2>Nächste öffentliche Märkte</h2>
            <p className="muted">Die ersten Events, die Besucher direkt ohne Login finden können.</p>
          </div>
          <Link className="btn ghost" to="/markets">
            Alle Märkte
          </Link>
        </div>
        <div className="public-card-grid">
          {!state.loading && state.events.length === 0 && !state.error && (
            <div className="card public-state-card" data-testid="public-page-empty">
              Noch keine öffentlichen Märkte sichtbar.
            </div>
          )}
          {state.events.map(event => (
            <PublicEventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-heading">
          <div>
            <h2>Ausgewählte Händler</h2>
            <p className="muted">Besucher entdecken Marken, Menschen und Waren direkt über die Plattform.</p>
          </div>
          <Link className="btn ghost" to="/vendors">
            Alle Händler
          </Link>
        </div>
        <div className="public-card-grid vendors">
          {!state.loading && state.vendors.length === 0 && !state.error && (
            <div className="card public-state-card" data-testid="public-page-empty">
              Noch keine öffentlichen Händlerprofile sichtbar.
            </div>
          )}
          {state.vendors.map(vendor => (
            <PublicVendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      </section>

      <section className="public-section public-explainer-grid">
        <article className="card public-copy-card">
          <h3>Für Besucher</h3>
          <p>
            Schnell sehen, welche Märkte anstehen, Händler ansehen und Informationen lesen, ohne zuerst
            ein Konto anzulegen. Genau das wird hier zur Startlogik der Plattform.
          </p>
        </article>

        <article className="card public-copy-card">
          <h3>Für Veranstalter</h3>
          <p>
            Öffentliche Events werden sichtbar, während der Verwaltungsbereich geschützt bleibt. So
            entsteht Reichweite nach außen, ohne interne Daten offenzulegen.
          </p>
        </article>

        <article className="card public-copy-card">
          <h3>Für Händler</h3>
          <p>
            Händlerprofile, Social Links und Eventteilnahmen machen kleine Marken auffindbar. Der Login
            ist nur für Pflege, nicht für die Sichtbarkeit nach außen.
          </p>
        </article>
      </section>
    </div>
  )
}
