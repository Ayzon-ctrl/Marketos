import { useEffect, useState } from 'react'
import { CalendarDays, Heart, MapPin, Store } from 'lucide-react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { fmtDate, fmtOpeningHours, getEventVenueFacts } from '../../lib/eventUtils'
import { loadEventFavoriteState, loadPublicMarketDetail, toggleEventFavorite } from '../../lib/publicData'
import PublicStandPricingSection from './PublicStandPricingSection'
import PublicVendorCard from './PublicVendorCard'
import { getUserErrorMessage } from '../../lib/userError'

export default function PublicMarketDetailPage() {
  const { eventId } = useParams()
  const { session } = useOutletContext()
  const [state, setState] = useState({
    loading: true,
    error: '',
    event: null,
    vendors: [],
    updates: [],
    standOptions: [],
    addonOptions: [],
    priceTiers: []
  })
  const [favoriteState, setFavoriteState] = useState({ loading: false, saved: false, error: '' })

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await loadPublicMarketDetail(eventId)
        if (!active) return
        setState({
          loading: false,
          error: '',
          event: data.event,
          vendors: data.vendors,
          updates: data.updates,
          standOptions: data.standOptions || [],
          addonOptions: data.addonOptions || [],
          priceTiers: data.priceTiers || []
        })
      } catch (error) {
        if (!active) return
        setState({
          loading: false,
          error: getUserErrorMessage(error, 'Marktdetails konnten nicht geladen werden.'),
          event: null,
          vendors: [],
          updates: []
        })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [eventId])

  useEffect(() => {
    let active = true
    if (!session?.user?.id || !eventId) {
      setFavoriteState({ loading: false, saved: false, error: '' })
      return
    }

    async function loadFavorite() {
      setFavoriteState(current => ({ ...current, loading: true, error: '' }))
      try {
        const saved = await loadEventFavoriteState(session.user.id, eventId)
        if (!active) return
        setFavoriteState({ loading: false, saved, error: '' })
      } catch (error) {
        if (!active) return
        setFavoriteState({ loading: false, saved: false, error: getUserErrorMessage(error, 'Favorit konnte nicht geladen werden.') })
      }
    }

    loadFavorite()
    return () => {
      active = false
    }
  }, [eventId, session])

  async function handleFavoriteToggle() {
    if (!session?.user?.id || !state.event) return
    setFavoriteState(current => ({ ...current, loading: true, error: '' }))
    try {
      const saved = await toggleEventFavorite({
        userId: session.user.id,
        eventId: state.event.id,
        saved: favoriteState.saved
      })
      setFavoriteState({ loading: false, saved, error: '' })
    } catch (error) {
      setFavoriteState(current => ({
        ...current,
        loading: false,
        error: getUserErrorMessage(error, 'Favorit konnte nicht gespeichert werden.')
      }))
    }
  }

  if (state.error) {
    return (
      <div className="public-page" data-testid="public-market-detail-page">
        <div className="card public-state-card" data-testid="public-page-error">
          <strong>Öffentlicher Markt braucht noch Setup</strong>
          <p>{state.error}</p>
        </div>
      </div>
    )
  }

  if (!state.loading && !state.event) {
    return (
      <div className="public-page" data-testid="public-market-detail-page">
        <div className="card public-state-card" data-testid="public-page-empty">
          Dieser Markt ist nicht öffentlich sichtbar oder existiert nicht mehr.
        </div>
      </div>
    )
  }

  const event = state.event

  return (
    <div className="public-page" data-testid="public-market-detail-page">
      {event && (
        <>
          <section className="public-detail-hero">
            <div>
              <div className="row detail-action-row">
                <Link className="btn ghost" to="/markets">
                  Zurück zu Märkten
                </Link>
                {session?.user ? (
                  <button
                    className={`btn ${favoriteState.saved ? 'secondary' : ''}`}
                    data-testid="favorite-event-toggle"
                    disabled={favoriteState.loading}
                    onClick={handleFavoriteToggle}
                    type="button"
                  >
                    <Heart size={16} />{' '}
                    {favoriteState.loading ? 'Speichert...' : favoriteState.saved ? 'Gespeichert' : 'Speichern'}
                  </button>
                ) : (
                  <span className="muted public-utility-note">
                    Zum Speichern bitte den Login oben rechts nutzen.
                  </span>
                )}
              </div>
              <h1>{event.title || 'Ohne Eventname'}</h1>
              <div className="public-detail-meta">
                <span>
                  <CalendarDays size={16} /> {fmtDate(event.event_date)}
                </span>
                <span>
                  <MapPin size={16} /> {event.location || 'Ort folgt'}
                </span>
                <span>
                  <Store size={16} /> {state.vendors.length} Händler
                </span>
              </div>
              <p className="public-detail-copy">
                {event.public_description ||
                  'Für dieses Event fehlt noch eine öffentliche Beschreibung. Datum, Ort und Händler sind trotzdem schon sichtbar.'}
              </p>
              {favoriteState.error && <p className="error">{favoriteState.error}</p>}
            </div>

            <div className="public-detail-summary">
              <div className="card">
                <strong>Öffnungszeiten</strong>
                <p>{fmtOpeningHours(event.opening_time, event.closing_time)}</p>
              </div>
              <div className="card">
                <strong>Begebenheiten</strong>
                <div className="public-facts">
                  {getEventVenueFacts(event).map(([active, label]) => (
                    <span className={`pill ${active ? 'ok' : ''}`} key={label}>
                      {label}: {active ? 'Ja' : 'Nein'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <PublicStandPricingSection
            standOptions={state.standOptions}
            priceTiers={state.priceTiers}
            addonOptions={state.addonOptions}
          />

          <section className="public-section">
            <div className="public-section-heading">
              <div>
                <h2>Aktuelle Updates</h2>
                <p className="muted">So sehen Besucher, was sich vor dem Markt noch verändert hat.</p>
              </div>
            </div>
            <div className="list">
              {state.updates.length === 0 && (
                <div className="card public-state-card" data-testid="public-page-empty">
                  Noch keine öffentlichen Updates für dieses Event.
                </div>
              )}
              {state.updates.map(update => (
                <div className="item" data-testid="public-event-update" key={update.id}>
                  <strong>{update.title}</strong>
                  <p className="muted">{update.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="public-section">
            <div className="public-section-heading">
              <div>
                <h2>Händler vor Ort</h2>
                <p className="muted">Nur öffentliche Händlerprofile werden hier sichtbar angezeigt.</p>
              </div>
            </div>

            <div className="public-card-grid vendors">
              {state.vendors.length === 0 && (
                <div className="card public-state-card" data-testid="public-page-empty">
                  Für dieses Event ist noch kein öffentliches Händlerprofil verknüpft.
                </div>
              )}
              {state.vendors.map(vendor => (
                <PublicVendorCard key={vendor.vendor_profile_id || vendor.id} vendor={vendor} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
